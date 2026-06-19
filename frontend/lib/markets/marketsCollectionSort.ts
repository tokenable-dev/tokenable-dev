/**
 * Sort helpers for `/markets` collection grid (not `lib/market/` pricing domain).
 */
import type {
  CollectionListMarketSnapshot,
  MarketplaceCollectionSummary,
} from "@/lib/core";
import { resolveMarketsListingMarketUsd, resolveMarketsListingMarketChangePct } from "@/lib/markets/marketsListingMarketPrice";

export const MARKETS_DEFAULT_SORT_ID = "pct_change_high" as const;

export const MARKETS_SORT_OPTIONS = [
  { id: "pct_change_high", label: "Highest % Chg." },
  { id: "recent_listed", label: "Recent listed" },
  { id: "high_price", label: "High price" },
  { id: "low_price", label: "Low price" },
  { id: "recent_sold", label: "Recent sold" },
] as const;

export type MarketsSortId = (typeof MARKETS_SORT_OPTIONS)[number]["id"];

export function collectionKeyLower(c: MarketplaceCollectionSummary): string {
  return c.collectionKey?.trim().toLowerCase() ?? "";
}

function marketsListMarketPriceUsd(
  collection: MarketplaceCollectionSummary,
  snapshot: CollectionListMarketSnapshot | undefined,
): number {
  const usd = resolveMarketsListingMarketUsd(collection, snapshot);
  if (usd != null) return usd;
  return Number.NEGATIVE_INFINITY;
}

function marketsHasListMarketPrice(
  collection: MarketplaceCollectionSummary,
  snapshot: CollectionListMarketSnapshot | undefined,
): boolean {
  return marketsListMarketPriceUsd(collection, snapshot) !== Number.NEGATIVE_INFINITY;
}

function compareMarketsByLabel(
  a: MarketplaceCollectionSummary,
  b: MarketplaceCollectionSummary,
): number {
  return (a.displayLabel ?? "").localeCompare(b.displayLabel ?? "");
}

function compareMarketsByMarketPriceDesc(
  a: MarketplaceCollectionSummary,
  b: MarketplaceCollectionSummary,
  snapByKey: Map<string, CollectionListMarketSnapshot>,
): number {
  const pa = marketsListMarketPriceUsd(a, snapByKey.get(collectionKeyLower(a)));
  const pb = marketsListMarketPriceUsd(b, snapByKey.get(collectionKeyLower(b)));
  if (pa !== pb) return pb - pa;
  return compareMarketsByLabel(a, b);
}

function compareMarketsByMarketPriceAsc(
  a: MarketplaceCollectionSummary,
  b: MarketplaceCollectionSummary,
  snapByKey: Map<string, CollectionListMarketSnapshot>,
): number {
  return compareMarketsByMarketPriceDesc(b, a, snapByKey);
}

function compareMarketsByMarketChangePct(
  a: MarketplaceCollectionSummary,
  b: MarketplaceCollectionSummary,
  snapByKey: Map<string, CollectionListMarketSnapshot>,
): number {
  const pa = resolveMarketsListingMarketChangePct(
    snapByKey.get(collectionKeyLower(a)),
  );
  const pb = resolveMarketsListingMarketChangePct(
    snapByKey.get(collectionKeyLower(b)),
  );
  const na =
    pa != null && Number.isFinite(pa) ? pa : Number.NEGATIVE_INFINITY;
  const nb =
    pb != null && Number.isFinite(pb) ? pb : Number.NEGATIVE_INFINITY;
  if (na !== nb) return nb - na;
  return compareMarketsByLabel(a, b);
}

function compareMarketsByRecentSold(
  a: MarketplaceCollectionSummary,
  b: MarketplaceCollectionSummary,
  snapByKey: Map<string, CollectionListMarketSnapshot>,
): number {
  const ta = snapByKey.get(collectionKeyLower(a))?.lastTokenableTradeAtSec ?? 0;
  const tb = snapByKey.get(collectionKeyLower(b))?.lastTokenableTradeAtSec ?? 0;
  if (ta !== tb) return tb - ta;
  return compareMarketsByLabel(a, b);
}

function marketsListMarketRecencyMs(
  collection: MarketplaceCollectionSummary,
  snapshot: CollectionListMarketSnapshot | undefined,
): number {
  const synced = snapshot?.syncedAt ? Date.parse(snapshot.syncedAt) : Number.NaN;
  if (Number.isFinite(synced)) return synced;
  const created = Date.parse(collection.createdAt);
  return Number.isFinite(created) ? created : 0;
}

function compareMarketsByRecentListed(
  a: MarketplaceCollectionSummary,
  b: MarketplaceCollectionSummary,
  snapByKey: Map<string, CollectionListMarketSnapshot>,
): number {
  const ta = marketsListMarketRecencyMs(a, snapByKey.get(collectionKeyLower(a)));
  const tb = marketsListMarketRecencyMs(b, snapByKey.get(collectionKeyLower(b)));
  if (ta !== tb) return tb - ta;
  return compareMarketsByLabel(a, b);
}

export function compareMarketsCollections(
  a: MarketplaceCollectionSummary,
  b: MarketplaceCollectionSummary,
  sortId: MarketsSortId,
  snapByKey: Map<string, CollectionListMarketSnapshot>,
): number {
  const snapA = snapByKey.get(collectionKeyLower(a));
  const snapB = snapByKey.get(collectionKeyLower(b));
  const hasPriceA = marketsHasListMarketPrice(a, snapA);
  const hasPriceB = marketsHasListMarketPrice(b, snapB);
  if (hasPriceA !== hasPriceB) {
    return hasPriceA ? -1 : 1;
  }

  switch (sortId) {
    case "recent_listed":
      return compareMarketsByRecentListed(a, b, snapByKey);
    case "pct_change_high":
      return compareMarketsByMarketChangePct(a, b, snapByKey);
    case "low_price":
      return compareMarketsByMarketPriceAsc(a, b, snapByKey);
    case "recent_sold":
      return compareMarketsByRecentSold(a, b, snapByKey);
    case "high_price":
    default:
      return compareMarketsByMarketPriceDesc(a, b, snapByKey);
  }
}
