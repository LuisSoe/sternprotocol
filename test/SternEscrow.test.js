const { expect } = require("chai");
const { ethers } = require("hardhat");
const { mine, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("SternEscrow", function () {
  const value = ethers.parseEther("10");
  const eblCid = "bafybeisternprotocolmvp";
  const commodity = "Indonesian coffee";
  const containerRef = "TGHU-2026-001";

  async function deployFixture() {
    const [owner, oracle, importer, exporter, arbiter, outsider] = await ethers.getSigners();
    const SternEscrow = await ethers.getContractFactory("SternEscrow");
    const sternEscrow = await SternEscrow.deploy(owner.address, oracle.address);
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
      ctx.sternEscrow.connect(ctx.oracle).submitVerification(escrowId, true, true, true, true)
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
      ctx.sternEscrow.connect(ctx.outsider).submitVerification(escrowId, true, true, true, true)
    ).to.be.revertedWith("not trusted oracle");
  });

  it("does not release when VGM does not match", async function () {
    const ctx = await deployFixture();
    const { escrowId } = await createEscrow(ctx);

    await mine(128);
    await ctx.sternEscrow.connect(ctx.oracle).submitVerification(escrowId, false, true, true, true);

    await expect(ctx.sternEscrow.connect(ctx.importer).releaseEscrow(escrowId)).to.be.revertedWith(
      "conditions not met"
    );

    const escrow = await ctx.sternEscrow.getEscrow(escrowId);
    expect(escrow.state).to.equal(0);
  });

  it("allows 2-of-3 disputed refund approval", async function () {
    const ctx = await deployFixture();
    const { escrowId } = await createEscrow(ctx);

    await ctx.sternEscrow.connect(ctx.oracle).submitVerification(escrowId, false, true, true, true);
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
    await ctx.sternEscrow.connect(ctx.oracle).submitVerification(escrowId, true, true, true, true);

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
});
