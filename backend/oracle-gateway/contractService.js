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

function getContract() {
  requireConfig(["rpcUrl", "oraclePrivateKey", "contractAddress"]);

  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const wallet = new ethers.Wallet(config.oraclePrivateKey, provider);
  return new ethers.Contract(config.contractAddress, loadAbi(), wallet);
}

async function submitOracleVerification(contractId, verification) {
  const contract = getContract();
  const tx = await contract.submitVerification(
    contractId,
    verification.vgmMatch,
    verification.aisDeparted,
    verification.ceisaApproved,
    verification.eblCidValid
  );
  const receipt = await tx.wait();
  return { transactionHash: receipt.hash, blockNumber: receipt.blockNumber };
}

async function openDispute(contractId) {
  const contract = getContract();
  const tx = await contract.openDispute(contractId);
  const receipt = await tx.wait();
  return { transactionHash: receipt.hash, blockNumber: receipt.blockNumber };
}

async function resolveDispute(contractId, releaseToExporter) {
  const contract = getContract();
  const tx = await contract.voteDisputeResolution(contractId, Boolean(releaseToExporter));
  const receipt = await tx.wait();
  return { transactionHash: receipt.hash, blockNumber: receipt.blockNumber };
}

module.exports = { submitOracleVerification, openDispute, resolveDispute };
