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

function normalizeOrderHash(orderHash: string): `0x${string}` {
  return (orderHash.startsWith("0x") ? orderHash : `0x${orderHash}`) as `0x${string}`;
}

export async function readSeaportOrderStatus(
  publicClient: PublicClient,
  orderHash: string,
): Promise<{
  isValidated: boolean;
  isCancelled: boolean;
  totalFilled: bigint;
  totalSize: bigint;
}> {
  const hash = normalizeOrderHash(orderHash);
  const [isValidated, isCancelled, totalFilled, totalSize] =
    await publicClient.readContract({
      address: SEAPORT_ADDRESS,
      abi: SEAPORT_ABI,
      functionName: "getOrderStatus",
      args: [hash],
    });
  return {
    isValidated: Boolean(isValidated),
    isCancelled: Boolean(isCancelled),
    totalFilled: BigInt(totalFilled),
    totalSize: BigInt(totalSize),
  };
}

/** True when Seaport can still consume this order (not cancelled / fully filled). */
export function seaportOrderHasRemainingFill(status: {
  isCancelled: boolean;
  totalFilled: bigint;
  totalSize: bigint;
}): boolean {
  if (status.isCancelled) return false;
  if (status.totalSize === BigInt(0)) return true;
  return status.totalFilled < status.totalSize;
}

/** Before matchAdvancedOrders — avoid OrderAlreadyFilled reverts from stale book rows. */
export async function assertSeaportOrdersFillableForMatch(
  publicClient: PublicClient,
  bidHash: string,
  askHash: string,
): Promise<void> {
  const [bid, ask] = await Promise.all([
    readSeaportOrderStatus(publicClient, bidHash),
    readSeaportOrderStatus(publicClient, askHash),
  ]);
  if (!seaportOrderHasRemainingFill(bid)) {
    throw new Error(
      "This collection bid is already filled or cancelled on Seaport (book may be stale). The buyer should place a new bid.",
    );
  }
  if (!seaportOrderHasRemainingFill(ask)) {
    throw new Error(
      "This listing is already filled or cancelled on Seaport. Refresh and list again if you still own the card.",
    );
  }
}

/** Seaport getOrderStatus — do not mark the book filled unless the order consumed on-chain. */
export async function requireSeaportOrderFilled(
  publicClient: PublicClient,
  orderHash: string,
): Promise<void> {
  const status = await readSeaportOrderStatus(publicClient, orderHash);
  if (
    status.isCancelled ||
    status.totalSize === BigInt(0) ||
    status.totalFilled < status.totalSize
  ) {
    throw new Error(
      "The on-chain trade did not fill. Listing and ownership were not updated. If the transaction reverted, nothing moved on-chain.",
    );
  }
}
