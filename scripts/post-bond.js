import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

const ABI = [
  "function postBond() external payable",
  "function oracleBonds(address) view returns (uint256)",
  "function oracleBond() view returns (uint256)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(
    process.env.RPC_URL || "https://polygon-amoy-bor-rpc.publicnode.com/"
  );
  const contractAddress = process.env.CONTRACT_ADDRESS;

  // Split berdasarkan koma
  const rawKeys = process.env.ORACLE_PRIVATE_KEYS || "";
  const privateKeys = rawKeys
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  if (privateKeys.length === 0) {
    console.error("❌ ORACLE_PRIVATE_KEYS tidak ditemukan di .env!");
    process.exit(1);
  }

  console.log(`Terdeteksi ${privateKeys.length} Oracle Private Keys dari .env.`);

  for (let i = 0; i < privateKeys.length; i++) {
    let key = privateKeys[i];
    // Pastikan private key punya prefix '0x' agar ethers.js tidak throw error
    if (!key.startsWith("0x")) {
      key = "0x" + key;
    }

    const wallet = new ethers.Wallet(key, provider);
    const contract = new ethers.Contract(contractAddress, ABI, wallet);

    console.log(`\n==================================================`);
    console.log(`[Oracle ${i + 1}] Address: ${wallet.address}`);

    try {
      const minBond = await contract.oracleBond();
      const currentBond = await contract.oracleBonds(wallet.address);

      console.log(`Syarat Minimal Bond : ${ethers.formatEther(minBond)} POL`);
      console.log(`Bond Saat Ini        : ${ethers.formatEther(currentBond)} POL`);

      if (currentBond >= minBond) {
        console.log(`✅ Oracle ${i + 1} SUDAH punya bond yang cukup. Skip!`);
        continue;
      }

      const amountToPost = minBond - currentBond;
      console.log(`⏳ Menyetor ${ethers.formatEther(amountToPost)} POL dari wallet ke postBond()...`);

      const tx = await contract.postBond({ value: amountToPost });
      console.log(`Tx sent: ${tx.hash}. Menunggu konfirmasi...`);
      await tx.wait();

      console.log(`🎉 SUCCESS! Oracle ${i + 1} (${wallet.address}) berhasil diposting bond-nya.`);
    } catch (err) {
      console.error(`❌ Gagal postBond untuk Oracle ${i + 1}:`, err.message);
    }
  }
}

main().catch(console.error);