import { ethers } from "ethers";

export const sternEscrowAbi = [
  "function nextEscrowId() view returns (uint256)",
  "function requiredConfirmations() view returns (uint256)",
  "function isReleaseEligible(uint256 escrowId) view returns (bool)",
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
