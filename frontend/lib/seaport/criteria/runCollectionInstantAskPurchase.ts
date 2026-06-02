import { formatUnits, type Address, type PublicClient } from "viem";
import { sepolia } from "@/config/wagmi";
import type { Order } from "@/lib/core";
import { fulfillAskListingOrder } from "@/lib/seaport/orders/fulfillAskListing";
import type { useWriteContract } from "wagmi";
import { askPriceMicros } from "./collectionCriteriaBidAsk";

export async function runCollectionInstantAskPurchase(input: {
  ask: Order;
  address: Address;
  publicClient: PublicClient;
  writeContractAsync: ReturnType<typeof useWriteContract>["writeContractAsync"];
}): Promise<number | null> {
  await fulfillAskListingOrder({
    ask: input.ask,
    address: input.address,
    publicClient: input.publicClient,
    writeContractAsync: input.writeContractAsync as Parameters<
      typeof fulfillAskListingOrder
    >[0]["writeContractAsync"],
    chainId: sepolia.id,
  });
  try {
    const paid = Number(formatUnits(askPriceMicros(input.ask), 6));
    if (Number.isFinite(paid) && paid > 0) return paid;
  } catch {
    /* ignore */
  }
  return null;
}
