import { ethers } from "ethers";

export const sternEscrowAbi = [
  "event EscrowCreated(uint256 indexed escrowId, address indexed importer, address indexed exporter, address arbiter, uint256 value, string eBLCID, string commodity, string containerRef, uint256 deadline)",
  "function nextEscrowId() view returns (uint256)",
  "function requiredConfirmations() view returns (uint256)",
  "function isReleaseEligible(uint256 escrowId) view returns (bool)",
  "function oracleQuorum() view returns (uint256)",
  "function getOracles() view returns (address[] addrs, uint256[] bonds, uint256[] slashes)",
  "function getAttestation(uint256 escrowId, address oracle) view returns ((bool submitted,bool vgmMatch,bool aisDeparted,bool ceisaApproved,bool eblCidValid,bool inspectionPassed))",
  "function slashedFor(uint256 escrowId, address oracle) view returns (bool)",
  "function pendingDeadline(uint256 escrowId) view returns (uint256)",
  "function extensionProposer(uint256 escrowId) view returns (address)",
  "function createEscrow(address exporterAddress,address arbiterAddress,string eBLCID,uint256 deadline,string commodity,string containerRef) payable returns (uint256)",
  "function releaseEscrow(uint256 escrowId)",
  "function claimRefund(uint256 escrowId)",
  "function openDispute(uint256 escrowId)",
  "function voteDisputeResolution(uint256 escrowId, bool releaseToExporter)",
  "function proposeDeadlineExtension(uint256 escrowId, uint256 newDeadline)",
  "function approveDeadlineExtension(uint256 escrowId)",
  "function getEscrow(uint256 escrowId) view returns ((uint256 contractValue,address exporterAddress,address importerAddress,address arbiterAddress,string eBLCID,uint256 deadline,uint256 createdBlock,string commodity,string containerRef,uint8 state,(bool vgmMatch,bool aisDeparted,bool ceisaApproved,bool eblCidValid,bool inspectionPassed,uint256 submittedAtBlock) verification,uint8 releaseApprovals,uint8 refundApprovals))"
];

export async function getBrowserContract({ requireSigner = true } = {}) {
  if (!window.ethereum) {
    throw new Error("No injected wallet found");
  }

  const address = import.meta.env.VITE_CONTRACT_ADDRESS;

  if (!address) {
    throw new Error("Missing VITE_CONTRACT_ADDRESS");
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  if (!requireSigner) {
    return new ethers.Contract(address, sternEscrowAbi, provider);
  }

  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  return new ethers.Contract(address, sternEscrowAbi, signer);
}
