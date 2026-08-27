/**
 * Sort helpers for `/markets` collection grid (not `lib/market/` pricing domain).
 */
import type {
  CollectionListMarketSnapshot,
  MarketplaceCollectionSummary,
} from "@/lib/core";
import { parseCollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import { resolveMarketsListingMarketUsd, resolveMarketsListingMarketChangePct } from "@/lib/markets/marketsListingMarketPrice";

export const MARKETS_DEFAULT_SORT_ID = "pct_change_high" as const;

/** Labels match `Tokenable-with design system-13/Markets.html` Sort menu. */
export const MARKETS_SORT_OPTIONS = [
  { id: "pct_change_high", label: "Top gainers" },
  { id: "low_price", label: "Price: low → high" },
  { id: "high_price", label: "Price: high → low" },
  { id: "recent_listed", label: "Newest listings" },
  { id: "population_low", label: "Population: low → high" },
  { id: "recent_sold", label: "Recent sold" },
] as const;

export type MarketsSortId = (typeof MARKETS_SORT_OPTIONS)[number]["id"];

/** Markets.html query aliases (`?sort=gainers` / `?sort=newest`). */
export const MARKETS_SORT_URL_ALIASES: Record<string, MarketsSortId> = {
  gainers: "pct_change_high",
  newest: "recent_listed",
};

export function resolveMarketsSortId(raw: string | null | undefined): MarketsSortId {
  const t = String(raw ?? "").trim();
  if (!t) return MARKETS_DEFAULT_SORT_ID;
  const aliased = MARKETS_SORT_URL_ALIASES[t] ?? t;
  return MARKETS_SORT_OPTIONS.some((o) => o.id === aliased)
    ? (aliased as MarketsSortId)
    : MARKETS_DEFAULT_SORT_ID;
}

/** Markets.html Sort menu order (excludes watchlist-only `recent_sold`). */
export const MARKETS_SORT_UI_IDS: readonly MarketsSortId[] = [
  "pct_change_high",
  "low_price",
  "high_price",
  "recent_listed",
  "population_low",
];

export function collectionKeyLower(
  c: MarketplaceCollectionSummary | null | undefined,
): string {
  return c?.collectionKey?.trim().toLowerCase() ?? "";
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

/** Catalog recency — same order as landing Just vaulted. */
export function compareCollectionsByCreatedAtDesc(
  a: MarketplaceCollectionSummary,
  b: MarketplaceCollectionSummary,
): number {
  const ta = Date.parse(a.createdAt);
  const tb = Date.parse(b.createdAt);
  const na = Number.isFinite(ta) ? ta : 0;
  const nb = Number.isFinite(tb) ? tb : 0;
  if (na !== nb) return nb - na;
  return compareMarketsByLabel(a, b);
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

function compareMarketsByPopulationAsc(
  a: MarketplaceCollectionSummary,
  b: MarketplaceCollectionSummary,
): number {
  const pop = (c: MarketplaceCollectionSummary) => {
    const n = parseCollectionComponents(c.components).psaTotalPopulation;
    return typeof n === "number" && n >= 0 ? n : Number.POSITIVE_INFINITY;
  };
  const pa = pop(a);
  const pb = pop(b);
  if (pa !== pb) return pa - pb;
  return compareMarketsByLabel(a, b);
}

export function compareMarketsCollections(
  a: MarketplaceCollectionSummary,
  b: MarketplaceCollectionSummary,
  sortId: MarketsSortId,
  snapByKey: Map<string, CollectionListMarketSnapshot>,
): number {
  if (sortId === "recent_listed") {
    return compareCollectionsByCreatedAtDesc(a, b);
  }

  const snapA = snapByKey.get(collectionKeyLower(a));
  const snapB = snapByKey.get(collectionKeyLower(b));
  const hasPriceA = marketsHasListMarketPrice(a, snapA);
  const hasPriceB = marketsHasListMarketPrice(b, snapB);
  if (hasPriceA !== hasPriceB) {
    return hasPriceA ? -1 : 1;
  }

  switch (sortId) {
    case "pct_change_high":
      return compareMarketsByMarketChangePct(a, b, snapByKey);
    case "low_price":
      return compareMarketsByMarketPriceAsc(a, b, snapByKey);
    case "recent_sold":
      return compareMarketsByRecentSold(a, b, snapByKey);
    case "population_low":
      return compareMarketsByPopulationAsc(a, b);
    case "high_price":
    default:
      return compareMarketsByMarketPriceDesc(a, b, snapByKey);
  }
}
