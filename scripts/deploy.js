const hre = require("hardhat");

// Confirmation depth: Polygon has ~5s deterministic finality (Heimdall v2);
// the depth is a circuit-breaker knob. Local demos use a low depth so release
// feels immediate; raise via REQUIRED_CONFIRMATIONS for cautious deployments.
const DEFAULT_CONFIRMATIONS = 5;
const DEFAULT_QUORUM = 2;
const DEFAULT_BOND_ETH = "1";

async function main() {
  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];
  // Oracle consortium: three independent verifiers (demo: Hardhat accounts #1, #4, #5,
  // playing Sucofindo / SGS / Port Authority). Accounts #2 and #3 stay reserved for
  // the exporter and arbiter demo identities.
  const oracleSigners = [signers[1], signers[4], signers[5]];

  const confirmations = Number(process.env.REQUIRED_CONFIRMATIONS || DEFAULT_CONFIRMATIONS);
  const quorum = Number(process.env.ORACLE_QUORUM || DEFAULT_QUORUM);
  const bond = hre.ethers.parseEther(process.env.ORACLE_BOND_ETH || DEFAULT_BOND_ETH);

  if (!Number.isInteger(confirmations) || confirmations < 1) {
    throw new Error(`REQUIRED_CONFIRMATIONS must be a positive integer, got: ${process.env.REQUIRED_CONFIRMATIONS}`);
  }
  if (!Number.isInteger(quorum) || quorum < 1 || quorum > oracleSigners.length) {
    throw new Error(`ORACLE_QUORUM must be between 1 and ${oracleSigners.length}, got: ${process.env.ORACLE_QUORUM}`);
  }

  const SternEscrow = await hre.ethers.getContractFactory("SternEscrow");
  const sternEscrow = await SternEscrow.deploy(
    deployer.address,
    oracleSigners.map((signer) => signer.address),
    quorum,
    bond,
    confirmations
  );
  await sternEscrow.waitForDeployment();

  for (const oracle of oracleSigners) {
    await (await sternEscrow.connect(oracle).postBond({ value: bond })).wait();
  }

  console.log("SternEscrow deployed to:", await sternEscrow.getAddress());
  console.log("Owner:", deployer.address);
  console.log("Oracle consortium (quorum %d-of-%d, bond %s ETH each):", quorum, oracleSigners.length, hre.ethers.formatEther(bond));
  oracleSigners.forEach((signer, index) => console.log(`  Oracle #${index}: ${signer.address} (bond posted)`));
  console.log("Required confirmations:", confirmations);
  console.log("Gateway env: set ORACLE_PRIVATE_KEYS to the comma-separated private keys of accounts #1, #4, #5.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
