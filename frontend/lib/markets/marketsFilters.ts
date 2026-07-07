import type { CollectionListMarketSnapshot, MarketplaceCollectionSummary } from "@/lib/core";
import { parseCollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import { resolveMarketsListingMarketUsd } from "@/lib/markets/marketsListingMarketPrice";
import { collectionKeyLower } from "@/lib/markets/marketsCollectionSort";

export type MarketsPriceFilterId =
  | "any"
  | "under_1k"
  | "1k_10k"
  | "10k_50k"
  | "50k_plus";

export type MarketsGradeFilterId = "PSA 10" | "BGS 9.5" | "PSA 9";

export const MARKETS_DEFAULT_PRICE_FILTER: MarketsPriceFilterId = "any";

export const MARKETS_PRICE_FILTER_OPTIONS: {
  id: MarketsPriceFilterId;
  menuLabel: string;
  chipLabel: string;
}[] = [
  { id: "any", menuLabel: "Any price", chipLabel: "Any" },
  { id: "under_1k", menuLabel: "Under $1,000", chipLabel: "Under $1k" },
  { id: "1k_10k", menuLabel: "$1,000 – $10,000", chipLabel: "$1k–$10k" },
  { id: "10k_50k", menuLabel: "$10,000 – $50,000", chipLabel: "$10k–$50k" },
  { id: "50k_plus", menuLabel: "$50,000+", chipLabel: "$50k+" },
];

export const MARKETS_GRADE_FILTER_OPTIONS: MarketsGradeFilterId[] = [
  "PSA 10",
  "BGS 9.5",
  "PSA 9",
];

export function formatCollectionGradeLabel(collection: MarketplaceCollectionSummary): string | null {
  const comp = parseCollectionComponents(collection.components);
  const company = (comp.gradingCompanyDisplay ?? comp.gradingCompany)?.trim();
  const score = comp.gradeScore?.trim();
  if (company && score) return `${company} ${score}`;
  const label = comp.psaGradeLabel?.trim();
  if (label) return label;
  if (score) {
    const fallbackCompany = comp.gradingCompany?.trim() || "PSA";
    return `${fallbackCompany} ${score}`;
  }
  return null;
}

export function collectionMatchesPriceFilter(
  collection: MarketplaceCollectionSummary,
  snapshot: CollectionListMarketSnapshot | undefined,
  priceFilter: MarketsPriceFilterId,
): boolean {
  if (priceFilter === "any") return true;
  const usd = resolveMarketsListingMarketUsd(collection, snapshot);
  if (usd == null || !Number.isFinite(usd)) return false;
  switch (priceFilter) {
    case "under_1k":
      return usd < 1_000;
    case "1k_10k":
      return usd >= 1_000 && usd < 10_000;
    case "10k_50k":
      return usd >= 10_000 && usd < 50_000;
    case "50k_plus":
      return usd >= 50_000;
    default:
      return true;
  }
}

export function collectionMatchesGradeFilters(
  collection: MarketplaceCollectionSummary,
  selectedGrades: ReadonlySet<MarketsGradeFilterId>,
): boolean {
  if (selectedGrades.size === 0) return true;
  const grade = formatCollectionGradeLabel(collection);
  if (!grade) return false;
  return selectedGrades.has(grade as MarketsGradeFilterId);
}

export function applyMarketsListingFilters(
  collections: MarketplaceCollectionSummary[],
  snapshotByKey: Map<string, CollectionListMarketSnapshot>,
  opts: {
    priceFilter: MarketsPriceFilterId;
    gradeFilters: ReadonlySet<MarketsGradeFilterId>;
  },
): MarketplaceCollectionSummary[] {
  return collections.filter((c) => {
    const snap = snapshotByKey.get(collectionKeyLower(c));
    if (!collectionMatchesPriceFilter(c, snap, opts.priceFilter)) return false;
    if (!collectionMatchesGradeFilters(c, opts.gradeFilters)) return false;
    return true;
  });
}
