import type { Order } from "@/lib/core";
import { SeaportSide } from "../constants";
import type {
  AdvancedOrderArg,
  CriteriaResolverArg,
  FulfillmentArg,
} from "./matchAdvancedOrdersArgs";
import { type Address, type Hex, zeroAddress } from "viem";

const BYTES32_ZERO =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

/** Backend / legacy clients mistakenly stored 32-byte zero as `zone`; viem needs a 20-byte address. */
export function normalizeSeaportZone(z: string): Address {
  const s = String(z).trim().toLowerCase();
  if (s === BYTES32_ZERO) return zeroAddress;
  return z as Address;
}

/** Seaport: `recipient === address(0)` means the caller receives fulfilled items (see OpenSea tests). */
const MATCH_RECIPIENT_ZERO =
  "0x0000000000000000000000000000000000000000" as Address;

/** Stored API values may be `0x…` (Merkle root) or decimal strings. */
function parseU256(s: string): bigint {
  const t = String(s).trim();
  return BigInt(t);
}

/** Map stored `Order` → `AdvancedOrder` tuple for Seaport (full fill, empty extraData). */
export function orderToAdvancedOrder(order: Order): AdvancedOrderArg {
  const p = order.parameters;
  return {
    parameters: {
      offerer: p.offerer as Address,
      zone: normalizeSeaportZone(String(p.zone)),
      offer: p.offer.map((i) => ({
        itemType: i.itemType,
        token: i.token as Address,
        identifierOrCriteria: parseU256(String(i.identifierOrCriteria)),
        startAmount: BigInt(i.startAmount),
        endAmount: BigInt(i.endAmount),
      })),
      consideration: p.consideration.map((i) => ({
        itemType: i.itemType,
        token: i.token as Address,
        identifierOrCriteria: parseU256(String(i.identifierOrCriteria)),
        startAmount: BigInt(i.startAmount),
        endAmount: BigInt(i.endAmount),
        recipient: i.recipient as Address,
      })),
      orderType: p.orderType,
      startTime: BigInt(p.startTime),
      endTime: BigInt(p.endTime),
      zoneHash: p.zoneHash as Hex,
      salt: BigInt(p.salt),
      conduitKey: p.conduitKey as Hex,
      totalOriginalConsiderationItems: BigInt(p.totalOriginalConsiderationItems),
    },
    numerator: BigInt(1),
    denominator: BigInt(1),
    signature: order.signature as Hex,
    extraData: "0x",
  };
}

export function isCriteriaCollectionBid(order: Order): boolean {
  const c = order.parameters?.consideration?.[0];
  return order.side === "bid" && c != null && Number(c.itemType) === 4;
}

/** Builds `matchAdvancedOrders` args for a token offer + listing (no Merkle). */
export function buildTokenBidMatchExecution(params: {
  tokenBidOrder: Order;
  listingOrder: Order;
}): {
  orders: AdvancedOrderArg[];
  criteriaResolvers: CriteriaResolverArg[];
  fulfillments: FulfillmentArg[];
  recipient: Address;
} {
  const buyerAdv = orderToAdvancedOrder(params.tokenBidOrder);
  const sellerAdv = orderToAdvancedOrder(params.listingOrder);
  const fulfillments: FulfillmentArg[] = [
    {
      offerComponents: [{ orderIndex: BigInt(0), itemIndex: BigInt(0) }],
      considerationComponents: [{ orderIndex: BigInt(1), itemIndex: BigInt(0) }],
    },
    {
      offerComponents: [{ orderIndex: BigInt(1), itemIndex: BigInt(0) }],
      considerationComponents: [{ orderIndex: BigInt(0), itemIndex: BigInt(0) }],
    },
  ];

  const listingConsiderationCount =
    params.listingOrder.parameters?.consideration?.length ?? 0;
  if (listingConsiderationCount > 1) {
    for (let i = 1; i < listingConsiderationCount; i++) {
      fulfillments.push({
        offerComponents: [{ orderIndex: BigInt(0), itemIndex: BigInt(0) }],
        considerationComponents: [
          { orderIndex: BigInt(1), itemIndex: BigInt(i) },
        ],
      });
    }
  }
  return {
    orders: [buyerAdv, sellerAdv],
    criteriaResolvers: [],
    fulfillments,
    recipient: MATCH_RECIPIENT_ZERO,
  };
}

/**
 * Builds `matchAdvancedOrders` args: criteria bid (order 0) + listing (order 1).
 * `criteriaProof` must be valid for `tokenId` against the bid’s Merkle root.
 */
export function buildCriteriaMatchExecution(params: {
  criteriaBidOrder: Order;
  listingOrder: Order;
  tokenId: bigint;
  criteriaProof: Hex[];
}): {
  orders: AdvancedOrderArg[];
  criteriaResolvers: CriteriaResolverArg[];
  fulfillments: FulfillmentArg[];
  /** Always `address(0)` — fulfiller is `msg.sender` per Seaport `matchAdvancedOrders` semantics. */
  recipient: Address;
} {
  const buyerAdv = orderToAdvancedOrder(params.criteriaBidOrder);
  const sellerAdv = orderToAdvancedOrder(params.listingOrder);
  const criteriaResolvers: CriteriaResolverArg[] = [
    {
      orderIndex: BigInt(0),
      side: SeaportSide.CONSIDERATION,
      index: BigInt(0),
      identifier: params.tokenId,
      criteriaProof: params.criteriaProof,
    },
  ];
  const fulfillments: FulfillmentArg[] = [
    // Bid USDC → Listing seller consideration
    {
      offerComponents: [{ orderIndex: BigInt(0), itemIndex: BigInt(0) }],
      considerationComponents: [{ orderIndex: BigInt(1), itemIndex: BigInt(0) }],
    },
    // Listing NFT → Bid NFT consideration
    {
      offerComponents: [{ orderIndex: BigInt(1), itemIndex: BigInt(0) }],
      considerationComponents: [{ orderIndex: BigInt(0), itemIndex: BigInt(0) }],
    },
  ];

  // If the listing has a platform fee consideration item, route bid USDC → fee recipient
  const listingConsiderationCount =
    params.listingOrder.parameters?.consideration?.length ?? 0;
  if (listingConsiderationCount > 1) {
    for (let i = 1; i < listingConsiderationCount; i++) {
      fulfillments.push({
        offerComponents: [{ orderIndex: BigInt(0), itemIndex: BigInt(0) }],
        considerationComponents: [
          { orderIndex: BigInt(1), itemIndex: BigInt(i) },
        ],
      });
    }
  }
  return {
    orders: [buyerAdv, sellerAdv],
    criteriaResolvers,
    fulfillments,
    recipient: MATCH_RECIPIENT_ZERO,
  };
}
