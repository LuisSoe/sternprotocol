const { expect } = require("chai");
const { ethers } = require("hardhat");
const { mine, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("SternEscrow", function () {
  const value = ethers.parseEther("10");
  const eblCid = "bafybeisternprotocolmvp";
  const commodity = "Indonesian coffee";
  const containerRef = "TGHU-2026-001";

  async function deployFixture(confirmations = 128) {
    const [owner, oracle, importer, exporter, arbiter, outsider] = await ethers.getSigners();
    const SternEscrow = await ethers.getContractFactory("SternEscrow");
    const sternEscrow = await SternEscrow.deploy(owner.address, oracle.address, confirmations);
    await sternEscrow.waitForDeployment();
    return { sternEscrow, owner, oracle, importer, exporter, arbiter, outsider };
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

  it("releases funds to exporter after all oracle checks and 128 blocks", async function () {
    const ctx = await deployFixture();
    const { escrowId } = await createEscrow(ctx);

    await mine(128);

    await expect(
      ctx.sternEscrow.connect(ctx.oracle).submitVerification(escrowId, true, true, true, true, true)
    )
      .to.emit(ctx.sternEscrow, "FundsReleased")
      .withArgs(escrowId, ctx.exporter.address, value)
      .and.to.emit(ctx.sternEscrow, "EBLTransferred")
      .withArgs(escrowId, eblCid, ctx.importer.address);

    const escrow = await ctx.sternEscrow.getEscrow(escrowId);
    expect(escrow.state).to.equal(2);
    expect(escrow.contractValue).to.equal(0);
  });

  it("rejects verification from non-oracle accounts", async function () {
    const ctx = await deployFixture();
    const { escrowId } = await createEscrow(ctx);

    await expect(
      ctx.sternEscrow.connect(ctx.outsider).submitVerification(escrowId, true, true, true, true, true)
    ).to.be.revertedWith("not trusted oracle");
  });

  it("does not release when VGM does not match", async function () {
    const ctx = await deployFixture();
    const { escrowId } = await createEscrow(ctx);

    await mine(128);
    await ctx.sternEscrow.connect(ctx.oracle).submitVerification(escrowId, false, true, true, true, true);

    await expect(ctx.sternEscrow.connect(ctx.importer).releaseEscrow(escrowId)).to.be.revertedWith(
      "conditions not met"
    );

    const escrow = await ctx.sternEscrow.getEscrow(escrowId);
    expect(escrow.state).to.equal(0);
  });

  it("does not release when inspection fails", async function () {
    const ctx = await deployFixture();
    const { escrowId } = await createEscrow(ctx);

    await mine(128);
    await ctx.sternEscrow.connect(ctx.oracle).submitVerification(escrowId, true, true, true, true, false);

    await expect(ctx.sternEscrow.connect(ctx.importer).releaseEscrow(escrowId)).to.be.revertedWith(
      "conditions not met"
    );

    const escrow = await ctx.sternEscrow.getEscrow(escrowId);
    expect(escrow.state).to.equal(0);
    expect(escrow.verification.inspectionPassed).to.equal(false);
  });

  it("allows 2-of-3 disputed refund approval", async function () {
    const ctx = await deployFixture();
    const { escrowId } = await createEscrow(ctx);

    await ctx.sternEscrow.connect(ctx.oracle).submitVerification(escrowId, false, true, true, true, true);
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
    await ctx.sternEscrow.connect(ctx.oracle).submitVerification(escrowId, true, true, true, true, true);

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

    await ctx.sternEscrow.connect(ctx.oracle).submitVerification(escrowId, true, true, true, true, true);

    let escrow = await ctx.sternEscrow.getEscrow(escrowId);
    expect(escrow.state).to.equal(1); // Verified, but not yet deep enough to auto-release

    await mine(5);
    await ctx.sternEscrow.connect(ctx.importer).releaseEscrow(escrowId);

    escrow = await ctx.sternEscrow.getEscrow(escrowId);
    expect(escrow.state).to.equal(2);
    expect(await ctx.sternEscrow.requiredConfirmations()).to.equal(5);
  });

  it("rejects deployment with zero confirmations", async function () {
    const [owner, oracle] = await ethers.getSigners();
    const SternEscrow = await ethers.getContractFactory("SternEscrow");
    await expect(SternEscrow.deploy(owner.address, oracle.address, 0)).to.be.revertedWith(
      "confirmations required"
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
    const newDeadline = deadline + 3 * 24 * 60 * 60;

    await ctx.sternEscrow.connect(ctx.exporter).proposeDeadlineExtension(escrowId, newDeadline);

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
});
