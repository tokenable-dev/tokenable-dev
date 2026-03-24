"use strict";

require("dotenv").config();

const fs = require("fs");
const { createSigner, initSeaport, fulfillSellOrder } = require("./seaport");

async function main() {
  if (!fs.existsSync("order.json")) {
    throw new Error("order.json not found. Run `pnpm create` first.");
  }

  const order = JSON.parse(fs.readFileSync("order.json", "utf-8"));

  const buyer = createSigner(
    process.env.BUYER_PRIVATE_KEY || process.env.PRIVATE_KEY,
    process.env.ALCHEMY_RPC_URL,
  );

  console.log(`Buyer: ${buyer.address}`);

  const seaport = initSeaport(buyer);
  const tx = await fulfillSellOrder(seaport, order, buyer.address);

  console.log(`\n✅ Tx sent: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`✅ Confirmed at block ${receipt.blockNumber}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
