const hre = require("hardhat");

// Confirmation depth: Polygon has ~5s deterministic finality (Heimdall v2);
// the depth is a circuit-breaker knob. Local demos use a low depth so release
// feels immediate; raise via REQUIRED_CONFIRMATIONS for cautious deployments.
const DEFAULT_CONFIRMATIONS = 5;

async function main() {
  const [deployer, oracle] = await hre.ethers.getSigners();
  const confirmations = Number(process.env.REQUIRED_CONFIRMATIONS || DEFAULT_CONFIRMATIONS);

  if (!Number.isInteger(confirmations) || confirmations < 1) {
    throw new Error(`REQUIRED_CONFIRMATIONS must be a positive integer, got: ${process.env.REQUIRED_CONFIRMATIONS}`);
  }

  const SternEscrow = await hre.ethers.getContractFactory("SternEscrow");
  const sternEscrow = await SternEscrow.deploy(deployer.address, oracle.address, confirmations);
  await sternEscrow.waitForDeployment();

  console.log("SternEscrow deployed to:", await sternEscrow.getAddress());
  console.log("Owner:", deployer.address);
  console.log("Trusted oracle:", oracle.address);
  console.log("Required confirmations:", confirmations);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
