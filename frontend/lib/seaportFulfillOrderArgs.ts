import type { Order } from "@/lib/api";

export const FULFILL_EXTRA_DATA =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

/** Seaport `fulfillOrder` 첫 인자 — 매도(ask) 이행·매수(bid) 수락 공통 */
export function fulfillSeaportOrderArgs(order: Order) {
  const params = order.parameters;
  return {
    parameters: {
      offerer: params.offerer as `0x${string}`,
      zone: params.zone as `0x${string}`,
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
