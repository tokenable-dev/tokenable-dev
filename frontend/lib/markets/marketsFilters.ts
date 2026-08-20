import type {
  CollectionListMarketSnapshot,
  MarketplaceCollectionSummary,
  Order,
} from "@/lib/core";
import { parseCollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import { resolveMarketsListingMarketUsd } from "@/lib/markets/marketsListingMarketPrice";
import { collectionKeyLower } from "@/lib/markets/marketsCollectionSort";

export type MarketsPriceFilterId =
  | "any"
  | "under_1k"
  | "1k_10k"
  | "10k_50k"
  | "50k_plus";

export type MarketsGradeFilterId =
  | "PSA 10"
  | "PSA 9"
  | "BGS Pristine"
  | "BGS 10"
  | "BGS 9.5";

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

/** Slim-bar Price pop — Markets.html `rangeHTML('price')` presets. */
export const MARKETS_PRICE_PRESET_CHIPS: {
  id: Exclude<MarketsPriceFilterId, "any">;
  chipLabel: string;
  min: string;
  max: string;
}[] = [
  { id: "under_1k", chipLabel: "Under $1k", min: "", max: "1000" },
  { id: "1k_10k", chipLabel: "$1k–$10k", min: "1000", max: "10000" },
  { id: "10k_50k", chipLabel: "$10k–$50k", min: "10000", max: "50000" },
  { id: "50k_plus", chipLabel: "$50k+", min: "50000", max: "" },
];

export const MARKETS_GRADE_FILTER_OPTIONS: MarketsGradeFilterId[] = [
  "PSA 10",
  "PSA 9",
  "BGS Pristine",
  "BGS 10",
  "BGS 9.5",
];

/** PSA / BGS grouped chips — markets-nav.js `gradeChipsHTML`. */
export function groupGradeFilterOptions(
  grades: readonly MarketsGradeFilterId[],
): { label: string; items: MarketsGradeFilterId[] }[] {
  const order: string[] = [];
  const groups = new Map<string, MarketsGradeFilterId[]>();
  for (const grade of grades) {
    const label = grade.split(" ")[0] ?? grade;
    if (!groups.has(label)) {
      order.push(label);
      groups.set(label, []);
    }
    groups.get(label)!.push(grade);
  }
  return order.map((label) => ({ label, items: groups.get(label) ?? [] }));
}

export function marketsPriceChipLabel(min: string, max: string): string | undefined {
  const a = min.trim();
  const b = max.trim();
  if (!a && !b) return undefined;
  const preset = MARKETS_PRICE_PRESET_CHIPS.find((p) => p.min === a && p.max === b);
  if (preset) return preset.chipLabel;
  if (a && b) return `$${a}–$${b}`;
  if (a) return `$${a}+`;
  return `Under $${b}`;
}

export type MarketsVaultFilterId = "psa" | "partner";

export const MARKETS_VAULT_FILTER_OPTIONS: {
  id: MarketsVaultFilterId;
  chipLabel: string;
}[] = [
  { id: "psa", chipLabel: "PSA Vault" },
  { id: "partner", chipLabel: "Partner vault" },
];

export function vaultKindFromAsk(order: {
  sellerDisplayName?: string | null;
  settlementPolicy?: string | null;
  vaultLabel?: string | null;
}): MarketsVaultFilterId {
  if (order.settlementPolicy === "self_vault_hold") return "partner";
  if (order.settlementPolicy === "standard") return "psa";
  const label = order.vaultLabel?.trim();
  if (label) return /^psa vault$/i.test(label) ? "psa" : "partner";
  return order.sellerDisplayName?.trim() ? "partner" : "psa";
}

export function collectionVaultKindsFromAsks(
  orders: readonly Pick<
    Order,
    "side" | "collectionKey" | "sellerDisplayName" | "settlementPolicy" | "vaultLabel"
  >[],
): Map<string, Set<MarketsVaultFilterId>> {
  const m = new Map<string, Set<MarketsVaultFilterId>>();
  for (const o of orders) {
    if (o.side === "bid") continue;
    const key = o.collectionKey?.trim().toLowerCase();
    if (!key) continue;
    let set = m.get(key);
    if (!set) {
      set = new Set();
      m.set(key, set);
    }
    set.add(vaultKindFromAsk(o));
  }
  return m;
}

export function collectionMatchesVaultFilters(
  collection: MarketplaceCollectionSummary,
  vaultKindsByKey: Map<string, Set<MarketsVaultFilterId>>,
  selected: ReadonlySet<MarketsVaultFilterId>,
): boolean {
  if (selected.size === 0) return true;
  const kinds = vaultKindsByKey.get(collectionKeyLower(collection));
  if (!kinds || kinds.size === 0) return false;
  for (const id of selected) {
    if (kinds.has(id)) return true;
  }
  return false;
}

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

/** Preset chips keep existing bucket logic; typed min/max use inclusive bounds. */
export function collectionMatchesPriceRange(
  collection: MarketplaceCollectionSummary,
  snapshot: CollectionListMarketSnapshot | undefined,
  minStr: string,
  maxStr: string,
): boolean {
  const a = minStr.trim();
  const b = maxStr.trim();
  if (!a && !b) return true;
  const preset = MARKETS_PRICE_PRESET_CHIPS.find((p) => p.min === a && p.max === b);
  if (preset) return collectionMatchesPriceFilter(collection, snapshot, preset.id);
  const usd = resolveMarketsListingMarketUsd(collection, snapshot);
  if (usd == null || !Number.isFinite(usd)) return false;
  if (a) {
    const min = Number(a);
    if (Number.isFinite(min) && usd < min) return false;
  }
  if (b) {
    const max = Number(b);
    if (Number.isFinite(max) && usd > max) return false;
  }
  return true;
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
    priceFilter?: MarketsPriceFilterId;
    priceMin?: string;
    priceMax?: string;
    gradeFilters: ReadonlySet<MarketsGradeFilterId>;
    vaultFilters?: ReadonlySet<MarketsVaultFilterId>;
    vaultKindsByKey?: Map<string, Set<MarketsVaultFilterId>>;
  },
): MarketplaceCollectionSummary[] {
  return collections.filter((c) => {
    const snap = snapshotByKey.get(collectionKeyLower(c));
    const priceOk =
      opts.priceMin != null || opts.priceMax != null
        ? collectionMatchesPriceRange(c, snap, opts.priceMin ?? "", opts.priceMax ?? "")
        : collectionMatchesPriceFilter(c, snap, opts.priceFilter ?? MARKETS_DEFAULT_PRICE_FILTER);
    if (!priceOk) return false;
    if (!collectionMatchesGradeFilters(c, opts.gradeFilters)) return false;
    if (
      opts.vaultFilters &&
      opts.vaultKindsByKey &&
      !collectionMatchesVaultFilters(c, opts.vaultKindsByKey, opts.vaultFilters)
    ) {
      return false;
    }
    return true;
  });
}
