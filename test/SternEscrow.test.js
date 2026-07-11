const { expect } = require("chai");
const { ethers } = require("hardhat");
const { mine, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("SternEscrow", function () {
  const value = ethers.parseEther("10");
  const bond = ethers.parseEther("1");
  const eblCid = "bafybeisternprotocolmvp";
  const commodity = "Indonesian coffee";
  const containerRef = "TGHU-2026-001";

  const allTrue = [true, true, true, true, true];
  const allFalse = [false, false, false, false, false];

  async function deployFixture(confirmations = 128, quorum = 2, { skipBonds = false } = {}) {
    const [owner, oracleA, importer, exporter, arbiter, outsider, oracleB, oracleC] =
      await ethers.getSigners();
    const oracles = [oracleA, oracleB, oracleC];

    const SternEscrow = await ethers.getContractFactory("SternEscrow");
    const sternEscrow = await SternEscrow.deploy(
      owner.address,
      oracles.map((oracle) => oracle.address),
      quorum,
      bond,
      confirmations
    );
    await sternEscrow.waitForDeployment();

    if (!skipBonds) {
      for (const oracle of oracles) {
        await sternEscrow.connect(oracle).postBond({ value: bond });
      }
    }

    return { sternEscrow, owner, oracles, oracleA, oracleB, oracleC, importer, exporter, arbiter, outsider };
  }

  async function createEscrow(ctx, overrides = {}) {
    const latest = await time.latest();
    const deadline = overrides.deadline || latest + 7 * 24 * 60 * 60;
    const escrowId = await ctx.sternEscrow.nextEscrowId();

    await ctx.sternEscrow.connect(ctx.importer).createEscrow(
      ctx.exporter.address,
      ctx.arbiter.address,
      overrides.eblCid || eblCid,
      deadline,
      overrides.commodity || commodity,
      overrides.containerRef || containerRef,
      { value: overrides.value || value }
    );

    return { escrowId, deadline };
  }

  function attest(ctx, oracle, escrowId, bools) {
    return ctx.sternEscrow.connect(oracle).submitAttestation(escrowId, ...bools);
  }

  it("releases funds to exporter once a quorum of oracles attests and depth passes", async function () {
    const ctx = await deployFixture();
    const { escrowId } = await createEscrow(ctx);

    await mine(128);

    await attest(ctx, ctx.oracleA, escrowId, allTrue);

    await expect(attest(ctx, ctx.oracleB, escrowId, allTrue))
      .to.emit(ctx.sternEscrow, "OracleVerificationSubmitted")
      .withArgs(escrowId, true, true, true, true, true)
      .and.to.emit(ctx.sternEscrow, "FundsReleased")
      .withArgs(escrowId, ctx.exporter.address, value)
      .and.to.emit(ctx.sternEscrow, "EBLTransferred")
      .withArgs(escrowId, eblCid, ctx.importer.address);

    const escrow = await ctx.sternEscrow.getEscrow(escrowId);
    expect(escrow.state).to.equal(2);
    expect(escrow.contractValue).to.equal(0);
  });

  it("does not finalize before the quorum is reached", async function () {
    const ctx = await deployFixture();
    const { escrowId } = await createEscrow(ctx);

    await mine(128);
    await attest(ctx, ctx.oracleA, escrowId, allTrue);

    const escrow = await ctx.sternEscrow.getEscrow(escrowId);
    expect(escrow.state).to.equal(0);
    expect(escrow.verification.submittedAtBlock).to.equal(0);
  });

  it("rejects attestations from non-consortium accounts", async function () {
    const ctx = await deployFixture();
    const { escrowId } = await createEscrow(ctx);

    await expect(attest(ctx, ctx.outsider, escrowId, allTrue)).to.be.revertedWith(
      "not consortium oracle"
    );
  });

  it("rejects attestations from an unbonded oracle", async function () {
    const ctx = await deployFixture(128, 2, { skipBonds: true });
    const { escrowId } = await createEscrow(ctx);

    await expect(attest(ctx, ctx.oracleA, escrowId, allTrue)).to.be.revertedWith(
      "oracle bond required"
    );
  });

  it("slashes an oracle that deviates from the consortium consensus", async function () {
    const ctx = await deployFixture();
    const { escrowId } = await createEscrow(ctx);

    await mine(128);

    // Dissenter reports first, then two honest oracles form the majority.
    await attest(ctx, ctx.oracleC, escrowId, allFalse);
    await attest(ctx, ctx.oracleA, escrowId, allTrue);

    await expect(attest(ctx, ctx.oracleB, escrowId, allTrue))
      .to.emit(ctx.sternEscrow, "OracleSlashed")
      .withArgs(escrowId, ctx.oracleC.address, bond / 2n)
      .and.to.emit(ctx.sternEscrow, "FundsReleased");

    expect(await ctx.sternEscrow.oracleBonds(ctx.oracleC.address)).to.equal(bond / 2n);
    expect(await ctx.sternEscrow.oracleSlashCount(ctx.oracleC.address)).to.equal(1);
    expect(await ctx.sternEscrow.oracleBonds(ctx.oracleA.address)).to.equal(bond);
    expect(await ctx.sternEscrow.treasury()).to.equal(bond / 2n);
  });

  it("keeps funds locked without slashing when the consortium agrees on a failure", async function () {
    const ctx = await deployFixture();
    const { escrowId } = await createEscrow(ctx);

    await mine(128);
    await attest(ctx, ctx.oracleA, escrowId, [false, true, true, true, true]);
    await attest(ctx, ctx.oracleB, escrowId, [false, true, true, true, true]);

    await expect(ctx.sternEscrow.connect(ctx.importer).releaseEscrow(escrowId)).to.be.revertedWith(
      "conditions not met"
    );

    const escrow = await ctx.sternEscrow.getEscrow(escrowId);
    expect(escrow.state).to.equal(0);
    expect(escrow.verification.vgmMatch).to.equal(false);
    expect(await ctx.sternEscrow.oracleSlashCount(ctx.oracleA.address)).to.equal(0);
  });

  it("allows 2-of-3 disputed refund approval", async function () {
    const ctx = await deployFixture();
    const { escrowId } = await createEscrow(ctx);

    await attest(ctx, ctx.oracleA, escrowId, [false, true, true, true, true]);
    await attest(ctx, ctx.oracleB, escrowId, [false, true, true, true, true]);

    await expect(ctx.sternEscrow.connect(ctx.exporter).openDispute(escrowId))
      .to.emit(ctx.sternEscrow, "DisputeOpened")
      .withArgs(escrowId, ctx.exporter.address);

    await ctx.sternEscrow.connect(ctx.importer).voteDisputeResolution(escrowId, false);

    await expect(ctx.sternEscrow.connect(ctx.arbiter).voteDisputeResolution(escrowId, false))
      .to.emit(ctx.sternEscrow, "Refunded")
      .withArgs(escrowId, ctx.importer.address, value)
      .and.to.emit(ctx.sternEscrow, "DisputeResolved")
      .withArgs(escrowId, false);

    const escrow = await ctx.sternEscrow.getEscrow(escrowId);
    expect(escrow.state).to.equal(3);
    expect(escrow.refundApprovals).to.equal(2);
  });

  it("allows importer refund after the deadline", async function () {
    const ctx = await deployFixture();
    const { escrowId, deadline } = await createEscrow(ctx);

    await time.increaseTo(deadline + 1);

    await expect(ctx.sternEscrow.connect(ctx.importer).claimRefund(escrowId))
      .to.emit(ctx.sternEscrow, "Refunded")
      .withArgs(escrowId, ctx.importer.address, value);

    const escrow = await ctx.sternEscrow.getEscrow(escrowId);
    expect(escrow.state).to.equal(3);
  });

  it("prevents double release after completion", async function () {
    const ctx = await deployFixture();
    const { escrowId } = await createEscrow(ctx);

    await mine(128);
    await attest(ctx, ctx.oracleA, escrowId, allTrue);
    await attest(ctx, ctx.oracleB, escrowId, allTrue);

    await expect(ctx.sternEscrow.connect(ctx.importer).releaseEscrow(escrowId)).to.be.revertedWith(
      "escrow already completed"
    );
  });

  it("prevents the same party from voting twice in a dispute", async function () {
    const ctx = await deployFixture();
    const { escrowId } = await createEscrow(ctx);

    await ctx.sternEscrow.connect(ctx.exporter).openDispute(escrowId);
    await ctx.sternEscrow.connect(ctx.importer).voteDisputeResolution(escrowId, false);

    await expect(
      ctx.sternEscrow.connect(ctx.importer).voteDisputeResolution(escrowId, false)
    ).to.be.revertedWith("already voted");
  });

  it("respects the configured confirmation depth", async function () {
    const ctx = await deployFixture(5);
    const { escrowId } = await createEscrow(ctx);

    await attest(ctx, ctx.oracleA, escrowId, allTrue);
    await attest(ctx, ctx.oracleB, escrowId, allTrue);

    let escrow = await ctx.sternEscrow.getEscrow(escrowId);
    expect(escrow.state).to.equal(1); // Verified, but not yet deep enough to auto-release

    await mine(5);
    await ctx.sternEscrow.connect(ctx.importer).releaseEscrow(escrowId);

    escrow = await ctx.sternEscrow.getEscrow(escrowId);
    expect(escrow.state).to.equal(2);
    expect(await ctx.sternEscrow.requiredConfirmations()).to.equal(5);
  });

  it("rejects invalid deployment parameters", async function () {
    const [owner, oracleA, , , , , oracleB, oracleC] = await ethers.getSigners();
    const oracles = [oracleA.address, oracleB.address, oracleC.address];
    const SternEscrow = await ethers.getContractFactory("SternEscrow");

    await expect(SternEscrow.deploy(owner.address, oracles, 2, bond, 0)).to.be.revertedWith(
      "confirmations required"
    );
    await expect(SternEscrow.deploy(owner.address, oracles, 4, bond, 5)).to.be.revertedWith(
      "not enough oracles for quorum"
    );
    await expect(SternEscrow.deploy(owner.address, oracles, 2, 0, 5)).to.be.revertedWith(
      "bond required"
    );
  });

  it("extends the deadline when proposer and counterparty both sign", async function () {
    const ctx = await deployFixture();
    const { escrowId, deadline } = await createEscrow(ctx);
    const newDeadline = deadline + 3 * 24 * 60 * 60;

    await expect(ctx.sternEscrow.connect(ctx.exporter).proposeDeadlineExtension(escrowId, newDeadline))
      .to.emit(ctx.sternEscrow, "DeadlineExtensionProposed")
      .withArgs(escrowId, ctx.exporter.address, newDeadline);

    await expect(ctx.sternEscrow.connect(ctx.importer).approveDeadlineExtension(escrowId))
      .to.emit(ctx.sternEscrow, "DeadlineExtended")
      .withArgs(escrowId, newDeadline);

    const escrow = await ctx.sternEscrow.getEscrow(escrowId);
    expect(escrow.deadline).to.equal(newDeadline);
    expect(await ctx.sternEscrow.pendingDeadline(escrowId)).to.equal(0);
  });

  it("prevents the proposer from approving their own extension", async function () {
    const ctx = await deployFixture();
    const { escrowId, deadline } = await createEscrow(ctx);

    await ctx.sternEscrow.connect(ctx.exporter).proposeDeadlineExtension(escrowId, deadline + 1000);

    await expect(
      ctx.sternEscrow.connect(ctx.exporter).approveDeadlineExtension(escrowId)
    ).to.be.revertedWith("proposer cannot approve");
  });

  it("rejects extension proposals from non-parties and shorter deadlines", async function () {
    const ctx = await deployFixture();
    const { escrowId, deadline } = await createEscrow(ctx);

    await expect(
      ctx.sternEscrow.connect(ctx.outsider).proposeDeadlineExtension(escrowId, deadline + 1000)
    ).to.be.revertedWith("only importer or exporter");

    await expect(
      ctx.sternEscrow.connect(ctx.exporter).proposeDeadlineExtension(escrowId, deadline - 1000)
    ).to.be.revertedWith("must extend deadline");

    await expect(
      ctx.sternEscrow.connect(ctx.importer).approveDeadlineExtension(escrowId)
    ).to.be.revertedWith("no pending extension");
  });

  it("clears a pending extension when a dispute locks the escrow state", async function () {
    const ctx = await deployFixture();
    const { escrowId, deadline } = await createEscrow(ctx);

    await ctx.sternEscrow.connect(ctx.exporter).proposeDeadlineExtension(escrowId, deadline + 1000);
    await ctx.sternEscrow.connect(ctx.importer).openDispute(escrowId);

    expect(await ctx.sternEscrow.pendingDeadline(escrowId)).to.equal(0);
    await expect(
      ctx.sternEscrow.connect(ctx.importer).approveDeadlineExtension(escrowId)
    ).to.be.revertedWith("escrow not amendable");
  });
});
