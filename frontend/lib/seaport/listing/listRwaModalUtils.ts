import type { Order } from "@/lib/core";
import { isCriteriaCollectionBid } from "@/lib/seaport/criteria/criteriaMatch";
import { bidUsdcAmount } from "@/lib/seaport/orders/bidUsdc";

/** Caps each marketplace HTTP call during instant-match so step 4 cannot hang forever. */
export function matchFlowHttpSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(22_000);
  }
  return undefined;
}

export function isAbortLikeError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  if (e.name === "AbortError" || e.name === "TimeoutError") return true;
  return (
    typeof DOMException !== "undefined" &&
    e instanceof DOMException &&
    e.name === "AbortError"
  );
}

export function orderCollectionKey(o: Order | null | undefined): string {
  if (!o) return "";
  const any = o as Order & { collection_key?: string };
  const k = o.collectionKey ?? any.collection_key;
  return k != null ? String(k).trim() : "";
}

export function shortBidder(addr: string) {
  const a = addr.startsWith("0x") ? addr : `0x${addr}`;
  if (a.length <= 14) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function resolveMatchCollectionKey(
  created: Order,
  propKey: string | null | undefined,
  existingAsk?: Order | null,
  bids?: Order[],
): string | undefined {
  const a = orderCollectionKey(created);
  const b = propKey != null ? propKey.trim() : "";
  const c = orderCollectionKey(existingAsk ?? undefined);
  let fromBid = "";
  for (const x of bids ?? []) {
    if (x.status === "active" && isCriteriaCollectionBid(x)) {
      const k = orderCollectionKey(x);
      if (k) {
        fromBid = k;
        break;
      }
    }
  }
  return a || b || c || fromBid || undefined;
}

export function listModalAssetLabel(tokenId: number, assetTitle?: string | null): string {
  const t = assetTitle?.trim();
  return t && t.length > 0 ? t : `Asset #${tokenId}`;
}

export function mergeBidsByOrderHash(api: Order[], hints: Order[]): Order[] {
  const m = new Map<string, Order>();
  for (const b of api) {
    if (b?.orderHash) m.set(b.orderHash, b);
  }
  for (const b of hints) {
    if (b?.orderHash && !m.has(b.orderHash)) m.set(b.orderHash, b);
  }
  return [...m.values()];
}

/**
 * Highest USDC bid first. Within the same price, FIFO by `createdAt` (oldest first),
 * then `orderHash`.
 *
 * If `preferred` is set and present, **only that bid** is returned — the seller
 * explicitly chose it (e.g. $1 while a $2 bid also crosses). Do not auto-upgrade
 * to a higher offer.
 */
export function orderMatchCandidates(merkleOk: Order[], preferred?: string | null): Order[] {
  const createdMs = (o: Order) => {
    const t = Date.parse(String(o.createdAt ?? ""));
    return Number.isFinite(t) ? t : 0;
  };
  const byPriceThenFifo = (a: Order, b: Order) => {
    const da = bidUsdcAmount(a);
    const db = bidUsdcAmount(b);
    if (da > db) return -1;
    if (da < db) return 1;
    const ta = createdMs(a);
    const tb = createdMs(b);
    if (ta !== tb) return ta - tb;
    return String(a.orderHash).localeCompare(String(b.orderHash));
  };
  const sorted = [...merkleOk].sort(byPriceThenFifo);
  const p = preferred?.trim();
  if (!p) return sorted;

  const pref = sorted.find((b) => b.orderHash === p);
  if (pref) return [pref];
  return sorted;
}

export function applyInstantOnlyProtection<T extends { matched: boolean; instantOnlyCancelled?: boolean }>(
  meta: T,
): T {
  const next = { ...meta };
  if (!next.matched) next.instantOnlyCancelled = true;
  return next;
}

/** Buyer cannot settle — keep the seller's updated ask (do not instant-only cancel). */
export function isBuyerFundingMatchFailure(
  reasonCode: string | undefined,
): boolean {
  return (
    reasonCode === "insufficient_balance" ||
    reasonCode === "insufficient_allowance"
  );
}
