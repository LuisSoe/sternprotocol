const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { config, requireConfig } = require("./config");

function loadAbi() {
  const artifactPath = path.resolve(
    __dirname,
    "../../artifacts/contracts/SternEscrow.sol/SternEscrow.json"
  );

  if (!fs.existsSync(artifactPath)) {
    const error = new Error("Contract artifact not found. Run `npm run compile` first.");
    error.statusCode = 400;
    throw error;
  }

  return JSON.parse(fs.readFileSync(artifactPath, "utf8")).abi;
}

function getProvider() {
  requireConfig(["rpcUrl", "contractAddress"]);
  return new ethers.JsonRpcProvider(config.rpcUrl);
}

function getOracleWallets(provider) {
  requireConfig(["oraclePrivateKeys"]);
  return config.oraclePrivateKeys.map((key) => new ethers.Wallet(key, provider));
}

function getContract(signerOrProvider) {
  return new ethers.Contract(config.contractAddress, loadAbi(), signerOrProvider);
}

// Each consortium member submits its own attestation. `dissentIndex` (demo
// harness) makes that oracle report the negated vector — the contract's
// consensus outvotes it and slashes its bond. The dissenter reports first so
// consensus finalizes on the last honest attestation.
async function submitOracleVerification(contractId, verification, dissentIndex) {
  const provider = getProvider();
  const wallets = getOracleWallets(provider);

  const ordered = wallets.map((wallet, index) => ({ wallet, index }));
  if (Number.isInteger(dissentIndex) && dissentIndex >= 0 && dissentIndex < ordered.length) {
    ordered.sort((a, b) => (a.index === dissentIndex ? -1 : b.index === dissentIndex ? 1 : 0));
  }

  const attestations = [];

  for (const { wallet, index } of ordered) {
    const dissent = index === dissentIndex;
    const vector = dissent
      ? [
          !verification.vgmMatch,
          !verification.aisDeparted,
          !verification.ceisaApproved,
          !verification.eblCidValid,
          !verification.inspectionPassed
        ]
      : [
          verification.vgmMatch,
          verification.aisDeparted,
          verification.ceisaApproved,
          verification.eblCidValid,
          verification.inspectionPassed
        ];

    const contract = getContract(wallet);
    const tx = await contract.submitAttestation(contractId, ...vector);
    const receipt = await tx.wait();
    attestations.push({
      oracle: wallet.address,
      oracleIndex: index,
      dissent,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber
    });
  }

  const last = attestations[attestations.length - 1];
  return {
    transactionHash: last.transactionHash,
    blockNumber: last.blockNumber,
    attestations
  };
}

async function openDispute(contractId) {
  const provider = getProvider();
  const [wallet] = getOracleWallets(provider);
  const tx = await getContract(wallet).openDispute(contractId);
  const receipt = await tx.wait();
  return { transactionHash: receipt.hash, blockNumber: receipt.blockNumber };
}

async function resolveDispute(contractId, releaseToExporter) {
  const provider = getProvider();
  const [wallet] = getOracleWallets(provider);
  const tx = await getContract(wallet).voteDisputeResolution(contractId, Boolean(releaseToExporter));
  const receipt = await tx.wait();
  return { transactionHash: receipt.hash, blockNumber: receipt.blockNumber };
}

module.exports = { submitOracleVerification, openDispute, resolveDispute };
