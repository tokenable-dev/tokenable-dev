import { formatUnits, type Address, type PublicClient } from "viem";
import type { SupportedChainId } from "@/lib/chains";
import type { Order } from "@/lib/core";
import { fulfillAskListingOrder } from "@/lib/seaport/orders/fulfillAskListing";
import type { BuyAskWrites } from "@/lib/seaport/fulfillment/fulfillAskListing";
import { askPriceMicros } from "./collectionCriteriaBidAsk";

export async function runCollectionInstantAskPurchase(input: {
  ask: Order;
  address: Address;
  publicClient: PublicClient;
  writes: BuyAskWrites;
  chainId: SupportedChainId;
}): Promise<number | null> {
  await fulfillAskListingOrder({
    ask: input.ask,
    address: input.address,
    publicClient: input.publicClient,
    writes: input.writes,
    chainId: input.chainId,
  });
  try {
    const paid = Number(formatUnits(askPriceMicros(input.ask), 6));
    if (Number.isFinite(paid) && paid > 0) return paid;
  } catch {
    /* ignore */
  }
  return null;
}
