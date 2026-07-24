import { Order, OrderSide, OrderStatus } from '../entities/order.entity';

/** Lightweight row for marketplace order lists (no Seaport parameters / signature). */
export type OrderListItem = {
  id: number;
  orderHash: string;
  tokenId: string;
  collectionKey: string | null;
  /** Raw USDC micros string (same as DB `consideration_amount`) */
  price: string;
  side: 'ask' | 'bid';
  status: OrderStatus;
  createdAt: string;
  updatedAt?: string;
  offerer: string;
  /** Active consignment partner display name when offerer matches. */
  sellerDisplayName?: string | null;
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
  return {
    id: o.id,
    orderHash: o.orderHash,
    tokenId: String(o.tokenId),
    collectionKey: o.collectionKey,
    price: o.considerationAmount,
    side,
    status: o.status,
    createdAt:
      o.createdAt instanceof Date
        ? o.createdAt.toISOString()
        : String(o.createdAt),
    updatedAt:
      o.updatedAt instanceof Date
        ? o.updatedAt.toISOString()
        : o.updatedAt != null
          ? String(o.updatedAt)
          : undefined,
    offerer: o.offerer,
    sellerDisplayName: sellerDisplayName ?? null,
    considerationRecipients: considerationRecipientsFromParams(o.parameters),
  };
}
