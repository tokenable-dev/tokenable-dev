"use strict";

require("dotenv").config();

const fs = require("fs");
const { createSigner, initSeaport, createSellOrder } = require("./seaport");

async function main() {
  const seller = createSigner(process.env.PRIVATE_KEY, process.env.ALCHEMY_RPC_URL);

  console.log(`Seller: ${seller.address}`);
  console.log(`NFT: ${process.env.NFT_CONTRACT_ADDRESS} #${process.env.TOKEN_ID}`);

  const seaport = initSeaport(seller);
  const order = await createSellOrder(seaport, {
    nftContract: process.env.NFT_CONTRACT_ADDRESS,
    tokenId: process.env.TOKEN_ID,
    priceEth: process.env.SELL_PRICE_ETH || "0.00001",
    sellerAddress: seller.address,
  });

  fs.writeFileSync("order.json", JSON.stringify(order, null, 2));
  console.log("\n✅ Order saved to order.json");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
