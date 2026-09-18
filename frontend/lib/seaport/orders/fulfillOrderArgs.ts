import type { PublicClient } from "viem";
import type { Order } from "@/lib/core";
import { SEAPORT_ADDRESS, SEAPORT_ABI } from "@/constants/contracts";
import { normalizeSeaportZone } from "../criteria/criteriaMatch";

export const FULFILL_EXTRA_DATA =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

/** Seaport `fulfillOrder` 첫 인자 — 매도(ask) 이행·매수(bid) 수락 공통 */
export function fulfillSeaportOrderArgs(order: Order) {
  const params = order.parameters;
  return {
    parameters: {
      offerer: params.offerer as `0x${string}`,
      zone: normalizeSeaportZone(String(params.zone)),
      offer: params.offer.map((item) => ({
        itemType: item.itemType,
        token: item.token as `0x${string}`,
        identifierOrCriteria: BigInt(item.identifierOrCriteria),
        startAmount: BigInt(item.startAmount),
        endAmount: BigInt(item.endAmount),
      })),
      consideration: params.consideration.map((item) => ({
        itemType: item.itemType,
        token: item.token as `0x${string}`,
        identifierOrCriteria: BigInt(item.identifierOrCriteria),
        startAmount: BigInt(item.startAmount),
        endAmount: BigInt(item.endAmount),
        recipient: item.recipient as `0x${string}`,
      })),
      orderType: params.orderType,
      startTime: BigInt(params.startTime),
      endTime: BigInt(params.endTime),
      zoneHash: params.zoneHash as `0x${string}`,
      salt: BigInt(params.salt),
      conduitKey: params.conduitKey as `0x${string}`,
      totalOriginalConsiderationItems: BigInt(params.totalOriginalConsiderationItems),
    },
    signature: order.signature as `0x${string}`,
  };
}

/** Seaport getOrderStatus — do not mark the book filled unless the order consumed on-chain. */
export async function requireSeaportOrderFilled(
  publicClient: PublicClient,
  orderHash: string,
): Promise<void> {
  const hash = (
    orderHash.startsWith("0x") ? orderHash : `0x${orderHash}`
  ) as `0x${string}`;
  const [, isCancelled, totalFilled, totalSize] = await publicClient.readContract({
    address: SEAPORT_ADDRESS,
    abi: SEAPORT_ABI,
    functionName: "getOrderStatus",
    args: [hash],
  });
  if (isCancelled || totalSize === BigInt(0) || totalFilled < totalSize) {
    throw new Error(
      "The on-chain trade did not fill. Listing and ownership were not updated. If the transaction reverted, nothing moved on-chain.",
    );
  }
}
