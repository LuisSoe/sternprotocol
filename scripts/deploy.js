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
  const isLocalNetwork = hre.network.name === "hardhat" || hre.network.name === "localhost";

  // Oracle consortium: three independent verifiers, playing Sucofindo / SGS / Port
  // Authority. Locally we reuse Hardhat's 20 pre-funded dev accounts (#1, #4, #5 —
  // #2/#3 stay reserved for the exporter/arbiter demo identities). On any other
  // network (e.g. Amoy) there are no free dev accounts, so the oracle signers come
  // from ORACLE_PRIVATE_KEYS via hardhat.config.js's `accounts` array instead —
  // signers[0] is the deployer (DEPLOYER_PRIVATE_KEY), signers[1..] are the oracles.
  const oracleSigners = isLocalNetwork ? [signers[1], signers[4], signers[5]] : signers.slice(1);

  if (oracleSigners.length < 3 || oracleSigners.some((signer) => !signer)) {
    throw new Error(
      `Need 3 oracle signers, found ${oracleSigners.filter(Boolean).length}. ` +
        "Set ORACLE_PRIVATE_KEYS in .env to 3 comma-separated private keys " +
        "(distinct testnet wallets — reused later by the oracle gateway)."
    );
  }
  oracleSigners.length = 3;

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
  console.log(
    isLocalNetwork
      ? "Gateway env: set ORACLE_PRIVATE_KEYS to the comma-separated private keys of accounts #1, #4, #5."
      : "Gateway env: ORACLE_PRIVATE_KEYS already holds these 3 keys — reuse the same .env value for the gateway."
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
