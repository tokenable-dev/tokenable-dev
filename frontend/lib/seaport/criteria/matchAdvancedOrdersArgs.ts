import { SEAPORT_MATCH_ADVANCED_ORDERS_ABI } from "@/constants/seaportMatchAdvancedAbi";
import type { Address, Hex } from "viem";

export type AdvancedOrderArg = {
  parameters: {
    offerer: Address;
    zone: Address;
    offer: {
      itemType: number;
      token: Address;
      identifierOrCriteria: bigint;
      startAmount: bigint;
      endAmount: bigint;
    }[];
    consideration: {
      itemType: number;
      token: Address;
      identifierOrCriteria: bigint;
      startAmount: bigint;
      endAmount: bigint;
      recipient: Address;
    }[];
    orderType: number;
    startTime: bigint;
    endTime: bigint;
    zoneHash: Hex;
    salt: bigint;
    conduitKey: Hex;
    totalOriginalConsiderationItems: bigint;
  };
  numerator: bigint;
  denominator: bigint;
  signature: Hex;
  extraData: Hex;
};

export type CriteriaResolverArg = {
  orderIndex: bigint;
  side: number;
  index: bigint;
  identifier: bigint;
  criteriaProof: Hex[];
};

export type FulfillmentArg = {
  offerComponents: { orderIndex: bigint; itemIndex: bigint }[];
  considerationComponents: { orderIndex: bigint; itemIndex: bigint }[];
};

/** Typed args for `matchAdvancedOrders` — pass to `writeContract` / `simulateContract`. */
export function matchAdvancedOrdersArgs(params: {
  orders: AdvancedOrderArg[];
  criteriaResolvers: CriteriaResolverArg[];
  fulfillments: FulfillmentArg[];
  recipient: Address;
}) {
  return {
    abi: SEAPORT_MATCH_ADVANCED_ORDERS_ABI,
    functionName: "matchAdvancedOrders" as const,
    args: [
      params.orders,
      params.criteriaResolvers,
      params.fulfillments,
      params.recipient,
    ] as const,
  };
}
