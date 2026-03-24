"use strict";

require("dotenv").config();

const { ethers } = require("ethers");
const { createSigner, initSeaport, createSellOrder, fulfillSellOrder } = require("./seaport");

const {
  PRIVATE_KEY,
  BUYER_PRIVATE_KEY,
  ALCHEMY_RPC_URL,
  NFT_CONTRACT_ADDRESS,
  TOKEN_ID,
  SELL_PRICE_ETH,
} = process.env;

function validate() {
  const required = { PRIVATE_KEY, ALCHEMY_RPC_URL, NFT_CONTRACT_ADDRESS, TOKEN_ID };
  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`Missing env vars: ${missing.join(", ")}`);
}

async function main() {
  validate();

  const priceEth = SELL_PRICE_ETH || "0.001";

  // ── Seller ────────────────────────────────────────────────────────
  const seller = createSigner(PRIVATE_KEY, ALCHEMY_RPC_URL);
  console.log(`\n👤 Seller : ${seller.address}`);
  console.log(`   Balance: ${ethers.utils.formatEther(await seller.getBalance())} ETH`);

  // ── Buyer ─────────────────────────────────────────────────────────
  const buyer = BUYER_PRIVATE_KEY
    ? createSigner(BUYER_PRIVATE_KEY, ALCHEMY_RPC_URL)
    : seller;
  console.log(`👤 Buyer  : ${buyer.address}`);
  console.log(`   Balance: ${ethers.utils.formatEther(await buyer.getBalance())} ETH`);

  if (seller.address === buyer.address) {
    console.warn("\n⚠️  Seller == Buyer. Set BUYER_PRIVATE_KEY for a separate buyer.");
  }

  console.log(`\n💎 NFT   : ${NFT_CONTRACT_ADDRESS} #${TOKEN_ID}`);
  console.log(`💰 Price : ${priceEth} ETH`);

  // ── Step 1: Create Sell Order ──────────────────────────────────────
  console.log("\n─── Step 1: Create Sell Order ───────────────────────────────");
  console.log("(NFT approve + EIP-712 서명 — 최초 approve 시에만 가스 소모)");

  const sellerSeaport = initSeaport(seller);
  const order = await createSellOrder(sellerSeaport, {
    nftContract: NFT_CONTRACT_ADDRESS,
    tokenId: TOKEN_ID,
    priceEth,
    sellerAddress: seller.address,
  });

  console.log("\n✅ Order created (off-chain):");
  console.log(JSON.stringify(order, null, 2));

  // ── Step 2: Fulfill Order ──────────────────────────────────────────
  console.log("\n─── Step 2: Fulfill Order (Buy) ─────────────────────────────");

  const buyerSeaport = initSeaport(buyer);
  const tx = await fulfillSellOrder(buyerSeaport, order, buyer.address);

  console.log(`\n✅ Transaction sent: ${tx.hash}`);
  console.log("   Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log(`✅ Confirmed at block: ${receipt.blockNumber}`);
  console.log(`\n🎉 NFT #${TOKEN_ID} transferred to ${buyer.address}`);
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message ?? err);
  process.exit(1);
});
