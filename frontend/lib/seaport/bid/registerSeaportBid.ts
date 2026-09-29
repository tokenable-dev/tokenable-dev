import type { Address } from "viem";
import {
  createOrder,
  replaceBidApi,
  type CreateOrderPayload,
  type Order,
} from "@/lib/core";

export async function registerSeaportBid(params: {
  address: Address;
  payload: CreateOrderPayload;
  mode: "create" | "replace";
  oldOrderHash?: string;
}): Promise<Order> {
  const { address, payload, mode, oldOrderHash } = params;
  if (mode === "replace" && oldOrderHash) {
    return replaceBidApi({
      callerAddress: address,
      oldOrderHash,
      order: payload,
    });
  }
  return createOrder(payload);
}
