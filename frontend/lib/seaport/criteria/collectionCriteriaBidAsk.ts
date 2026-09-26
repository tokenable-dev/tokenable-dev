import { formatUnits, parseUnits } from "viem";
import { getMarketplaceCollectionDetail, type Order } from "@/lib/core";

export function isListingAskRow(o: Order): boolean {
  const s = String(o.side ?? "ask").toLowerCase();
  return s !== "bid";
}

export function askPriceMicros(o: Order): bigint {
  try {
    const listed = o as Order & { price?: string };
    const raw = o.considerationAmount ?? listed.price;
    const s = typeof raw === "bigint" ? String(raw) : String(raw ?? "").trim();
    if (!s) return BigInt(0);
    if (s.includes(".")) {
      return parseUnits(s, 6);
    }
    return BigInt(s);
  } catch {
    return BigInt(0);
  }
}

function isActiveAskStatus(o: Order): boolean {
  return o.status == null || String(o.status).toLowerCase() === "active";
}

export function sortActiveAsksLowestFirst(activeAsks: Order[]): Order[] {
  const cands = activeAsks.filter((o) => isActiveAskStatus(o) && isListingAskRow(o));
  cands.sort((a, b) => {
    const pa = askPriceMicros(a);
    const pb = askPriceMicros(b);
    if (pa !== pb) return pa < pb ? -1 : 1;
    return Number(a.tokenId) - Number(b.tokenId);
  });
  return cands;
}

export function pickLowestActiveAsk(activeAsks: Order[]): Order | null {
  return sortActiveAsksLowestFirst(activeAsks)[0] ?? null;
}

function askWindowOpen(o: Order, nowMs = Date.now()): boolean {
  const end = Date.parse(String(o.endTime ?? ""));
  if (Number.isFinite(end) && end > 0 && end < nowMs) return false;
  const start = Date.parse(String(o.startTime ?? ""));
  if (Number.isFinite(start) && start > nowMs) return false;
  return true;
}

/**
 * Lowest live ask that this bid would take (bid ≥ ask), including the bidder’s own listing.
 */
export function pickCrossingAskForBid(
  asks: Order[],
  _bidder: string,
  bidUnits: bigint,
  nowMs = Date.now(),
): Order | null {
  if (bidUnits <= BigInt(0)) return null;
  const crossed = asks.filter((o) => {
    if (o.status != null && String(o.status).toLowerCase() !== "active") {
      return false;
    }
    if (!isListingAskRow(o)) return false;
    if (!askWindowOpen(o, nowMs)) return false;
    const price = askPriceMicros(o);
    return price > BigInt(0) && bidUnits >= price;
  });
  return pickLowestActiveAsk(crossed);
}

/** Whole-dollar bid vs live asks — same rule as `pickCrossingAskForBid`. */
export function bidWholeUsdCrossesLiveAsk(
  asks: Order[],
  bidder: string,
  bidWholeUsd: number,
): boolean {
  if (!(bidWholeUsd > 0) || !Number.isFinite(bidWholeUsd)) return false;
  try {
    const bidUnits = parseUnits(String(Math.round(bidWholeUsd)), 6);
    return pickCrossingAskForBid(asks, bidder, bidUnits) != null;
  } catch {
    return false;
  }
}

export class BidCrossesLiveAskError extends Error {
  readonly ask: Order;
  constructor(ask: Order) {
    super(
      "BID_CROSSES_ASK: Buy the live listing instead of placing a bid that meets or exceeds the ask.",
    );
    this.name = "BidCrossesLiveAskError";
    this.ask = ask;
  }
}

/** Fresh collection listings — do not rely on a stale React Query cache. */
export async function fetchCrossingAskForBid(input: {
  collectionKey: string;
  bidder: string;
  bidUnits: bigint;
}): Promise<Order | null> {
  const key = input.collectionKey.trim();
  if (!key || input.bidUnits <= BigInt(0)) return null;
  const detail = await getMarketplaceCollectionDetail(key, { bypassCache: true });
  return pickCrossingAskForBid(
    detail.listings ?? [],
    input.bidder,
    input.bidUnits,
  );
}

export function pickLowestActiveAskCandidates(activeAsks: Order[]): Order[] {
  const cands = activeAsks.filter((o) => isActiveAskStatus(o) && isListingAskRow(o));
  if (cands.length === 0) return [];
  cands.sort((a, b) => {
    const pa = askPriceMicros(a);
    const pb = askPriceMicros(b);
    if (pa !== pb) return pa < pb ? -1 : 1;
    return Number(a.tokenId) - Number(b.tokenId);
  });
  const floor = askPriceMicros(cands[0]!);
  return cands.filter((o) => askPriceMicros(o) === floor);
}

export function formatCriteriaBidUsdc6(amountStr: string): string {
  try {
    const n = Number(formatUnits(BigInt(amountStr), 6));
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return amountStr;
  }
}
