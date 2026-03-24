"use strict";

/**
 * TestNFT 배포 + 첫 번째 토큰 mint
 * 실행: npx hardhat run scripts/deploy.js --network sepolia
 */

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log(
    "Balance :",
    ethers.formatEther(await deployer.provider.getBalance(deployer.address)),
    "ETH",
  );

  // ── Deploy TestNFT ──────────────────────────────────────────────
  console.log("\nDeploying TestNFT...");
  const TestNFT = await ethers.getContractFactory("TestNFT");
  const nft = await TestNFT.deploy();
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log("✅ TestNFT deployed to:", nftAddress);

  // ── Mint Token #0 to deployer ───────────────────────────────────
  console.log("\nMinting token #0...");
  const tx = await nft.mint(deployer.address);
  const receipt = await tx.wait();
  const mintEvent = receipt.events?.find((e) => e.event === "Minted");
  const tokenId = mintEvent?.args?.tokenId?.toString() ?? "0";

  console.log(`✅ Minted token #${tokenId} to ${deployer.address}`);
  console.log("   Tx hash:", tx.hash);

  // ── Print .env values ───────────────────────────────────────────
  console.log("\n─── Add these to your .env ───────────────────────────────────");
  console.log(`NFT_CONTRACT_ADDRESS=${nftAddress}`);
  console.log(`TOKEN_ID=${tokenId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
