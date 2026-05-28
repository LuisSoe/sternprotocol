const hre = require("hardhat");

async function main() {
  const [deployer, oracle] = await hre.ethers.getSigners();
  const SternEscrow = await hre.ethers.getContractFactory("SternEscrow");
  const sternEscrow = await SternEscrow.deploy(deployer.address, oracle.address);
  await sternEscrow.waitForDeployment();

  console.log("SternEscrow deployed to:", await sternEscrow.getAddress());
  console.log("Owner:", deployer.address);
  console.log("Trusted oracle:", oracle.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
