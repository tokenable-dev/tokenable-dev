import { Order, OrderSide, OrderStatus } from '../entities/order.entity';

/** Lightweight row for marketplace order lists (no Seaport parameters / signature). */
export type OrderListItem = {
  id: number;
  orderHash: string;
  tokenId: string;
  collectionKey: string | null;
  /** Raw USDC micros string (same as DB `consideration_amount`) */
  price: string;
  /**
   * Actual USDC micros settled when known (sell-into-bid may differ from ask list price).
   * Falls back to `price` when absent.
   */
  settlementPrice?: string;
  side: 'ask' | 'bid';
  status: OrderStatus;
  createdAt: string;
  /** Unix ISO timestamp for order expiry (Seaport endTime). */
  endTime?: string;
  updatedAt?: string;
  offerer: string;
  /** Buyer wallet recorded on ask fill (`parameters._filledByBuyer`). */
  filledByBuyer?: string | null;
  /** Paired counterparty order hash when matched (`_matchedBidOrderHash` / `_matchedAskOrderHash`). */
  matchedOrderHash?: string | null;
  /** Active consignment partner display name when offerer matches. */
  sellerDisplayName?: string | null;
  /** Token custody — `self_vault_hold` vs PSA. Null on bids. */
  settlementPolicy?: 'standard' | 'self_vault_hold' | null;
  /** "PSA Vault" or "{partner} vault" from token custody, not seller identity. */
  vaultLabel?: string | null;
  /** Distinct `consideration[].recipient` for analytics (e.g. unique traders) */
  considerationRecipients: string[];
};

function considerationRecipientsFromParams(
  parameters: Record<string, unknown> | null | undefined,
): string[] {
  const cons = parameters?.['consideration'];
  if (!Array.isArray(cons)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of cons) {
    if (
      c &&
      typeof c === 'object' &&
      typeof (c as { recipient?: string }).recipient === 'string'
    ) {
      const r = (c as { recipient: string }).recipient.trim();
      if (!r) continue;
      const k = r.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
  }
  return out;
}

export function orderToListItem(
  o: Order,
  sellerDisplayName?: string | null,
): OrderListItem {
  const side = o.side === OrderSide.BID ? 'bid' : 'ask';
  const params = (o.parameters ?? {}) as Record<string, unknown>;
  const settlementRaw = params['_settlementAmount'];
  const settlementPrice =
    typeof settlementRaw === 'string' && settlementRaw.trim()
      ? settlementRaw.trim()
      : undefined;
  const filledBy =
    typeof params['_filledByBuyer'] === 'string'
      ? params['_filledByBuyer'].trim().toLowerCase()
      : null;
  const matched =
    (typeof params['_matchedBidOrderHash'] === 'string' &&
      params['_matchedBidOrderHash'].trim()) ||
    (typeof params['_matchedAskOrderHash'] === 'string' &&
      params['_matchedAskOrderHash'].trim()) ||
    null;

  return {
    id: o.id,
    orderHash: o.orderHash,
    tokenId: String(o.tokenId),
    collectionKey: o.collectionKey,
    price: o.considerationAmount,
    settlementPrice,
    side,
    status: o.status,
    createdAt:
      o.createdAt instanceof Date
        ? o.createdAt.toISOString()
        : String(o.createdAt),
    endTime:
      o.endTime instanceof Date
        ? o.endTime.toISOString()
        : o.endTime != null
          ? String(o.endTime)
          : undefined,
    updatedAt:
      o.updatedAt instanceof Date
        ? o.updatedAt.toISOString()
        : o.updatedAt != null
          ? String(o.updatedAt)
          : undefined,
    offerer: o.offerer,
    filledByBuyer: filledBy || null,
    matchedOrderHash: matched || null,
    sellerDisplayName: sellerDisplayName ?? null,
    considerationRecipients: considerationRecipientsFromParams(o.parameters),
  };
}
