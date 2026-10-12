import type {
  CollectionListMarketSnapshot,
  MarketplaceCollectionSummary,
  Order,
} from "@/lib/core";
import {
  parseCollectionComponents,
  type CollectionComponents,
} from "@/lib/marketplace/collectionDetailComponents";
import {
  leadingYearFromSetLine,
  resolveCollectionSetFacetLabelFromLine,
  stripLeadingYearFromSetLine,
  toCardDisplayCase,
  yearFromComponents,
} from "@/lib/marketplace/collectionFullDetailsTitle";
import { bucketCardNameForDisplay, bucketCardSetForDisplay } from "@/lib/marketplace/bucketKey";
import { extractLeadingTcgSeriesFromSetDisplay } from "@/lib/marketplace/cardDisplayName";
import { resolveCollectionSlabSetLine } from "@/lib/marketplace/slabDisplayTitle";
import { parseFiniteGradeScore } from "@/lib/market/psaGradePolicy";
import { formatDetailExpansionSetName } from "@/lib/marketplace/cardDisplayName";
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
  { id: "partner", chipLabel: "Tokenable Vault" },
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
      return usd >= 1_000 && usd <= 10_000;
    case "10k_50k":
      return usd >= 10_000 && usd <= 50_000;
    case "50k_plus":
      return usd >= 50_000;
    default:
      return true;
  }
}

function finiteNonNegative(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Drop junk, and swap when min is above max so a reversed range still matches. */
export function normalizeMarketsPriceInputs(
  minStr: string,
  maxStr: string,
): { min: string; max: string } {
  let min = finiteNonNegative(minStr);
  let max = finiteNonNegative(maxStr);
  if (min != null && max != null && min > max) {
    const swap = min;
    min = max;
    max = swap;
  }
  return {
    min: min == null ? "" : String(min),
    max: max == null ? "" : String(max),
  };
}

/**
 * Preset chips use the labeled buckets (`Under $1,000` is strictly below).
 * Typed min/max are inclusive. A reversed pair is swapped, not treated as empty.
 */
export function collectionMatchesPriceRange(
  collection: MarketplaceCollectionSummary,
  snapshot: CollectionListMarketSnapshot | undefined,
  minStr: string,
  maxStr: string,
): boolean {
  const { min: a, max: b } = normalizeMarketsPriceInputs(minStr, maxStr);
  if (!a && !b) return true;
  const preset = MARKETS_PRICE_PRESET_CHIPS.find((p) => p.min === a && p.max === b);
  if (preset) return collectionMatchesPriceFilter(collection, snapshot, preset.id);
  const usd = resolveMarketsListingMarketUsd(collection, snapshot);
  if (usd == null || !Number.isFinite(usd)) return false;
  if (a && usd < Number(a)) return false;
  if (b && usd > Number(b)) return false;
  return true;
}

function gradeScoreNumber(comp: CollectionComponents): number | null {
  const direct = parseFiniteGradeScore(comp.gradeScore);
  if (direct != null) return direct;
  const text = [comp.psaGradeLabel, comp.psaGradeDescription]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .join(" ");
  const m = text.match(/(\d{1,2}(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1] ?? "");
  return Number.isFinite(n) ? n : null;
}

function sameGradeScore(score: number, target: number): boolean {
  return Math.abs(score - target) < 0.001;
}

/**
 * Map a slab onto a filter checkbox.
 * "GEM MT 10" is PSA 10. BGS Pristine / Black Label is not BGS 10.
 */
export function collectionGradeFilterId(
  collection: MarketplaceCollectionSummary,
): MarketsGradeFilterId | null {
  const comp = parseCollectionComponents(collection.components);
  const company = (comp.gradingCompanyDisplay ?? comp.gradingCompany ?? "").trim();
  const kind = /bgs|beckett/i.test(company)
    ? "bgs"
    : /psa/i.test(company) || !company
      ? "psa"
      : "other";
  const text = [comp.psaGradeLabel, comp.psaGradeDescription, comp.gradeScore]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .join(" ");
  const pristine = /pristine|black\s*label/i.test(text);
  const score = gradeScoreNumber(comp);

  if (kind === "bgs" && pristine) return "BGS Pristine";
  if (kind === "bgs" && score != null && sameGradeScore(score, 10)) return "BGS 10";
  if (kind === "bgs" && score != null && sameGradeScore(score, 9.5)) return "BGS 9.5";
  if (kind === "psa" && score != null && sameGradeScore(score, 10)) return "PSA 10";
  if (kind === "psa" && score != null && sameGradeScore(score, 9)) return "PSA 9";

  const label = formatCollectionGradeLabel(collection);
  if (label && MARKETS_GRADE_FILTER_OPTIONS.includes(label as MarketsGradeFilterId)) {
    return label as MarketsGradeFilterId;
  }
  return null;
}

export function collectionMatchesGradeFilters(
  collection: MarketplaceCollectionSummary,
  selectedGrades: ReadonlySet<MarketsGradeFilterId>,
): boolean {
  if (selectedGrades.size === 0) return true;
  const grade = collectionGradeFilterId(collection);
  if (!grade) return false;
  return selectedGrades.has(grade);
}

function normalizeFacetToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Card.html `set=151 EN` vs Markets facet `151` / `151 English`. */
function setFacetNeedles(raw: string): string[] {
  const n = normalizeFacetToken(stripLeadingYearFromSetLine(raw));
  if (!n) return [];
  const stripped = n.replace(/\s+(en|jp|kr|english|japanese)$/i, "").trim();
  return stripped && stripped !== n ? [n, stripped] : [n];
}

/**
 * Set checkbox / `set=` label — expansion name (`151`, `Carrying On His Will`),
 * not the raw PSA brand line. Year, franchise, language, and set code are dropped.
 */
export function resolveCollectionSetFacetLabel(
  comp: CollectionComponents,
  opts?: { setLineHint?: string | null; marketSetName?: string | null },
): string {
  const catalogName = comp.normalizedPokemon?.setName?.trim() || "";
  const raw =
    catalogName ||
    opts?.setLineHint?.trim() ||
    resolveCollectionSlabSetLine(comp)?.trim() ||
    bucketCardSetForDisplay(comp).trim() ||
    opts?.marketSetName?.trim() ||
    "";
  const expansion = formatDetailExpansionSetName({
    setName: catalogName || opts?.marketSetName,
    setLine: raw,
    language: comp.normalizedPokemon?.language || comp.language,
  });
  const label = expansion || resolveCollectionSetFacetLabelFromLine(raw);
  return toCardDisplayCase(label);
}

/** Unique set facet labels from loaded collections (same strings Details links use). */
export function collectMarketsSetFacetOptions(
  collections: readonly MarketplaceCollectionSummary[],
  limit = 48,
): string[] {
  const seen = new Map<string, string>();
  for (const c of collections) {
    const comp = parseCollectionComponents(c.components);
    const label = resolveCollectionSetFacetLabel(comp);
    if (!label) continue;
    const key = normalizeFacetToken(label);
    if (!key || seen.has(key)) continue;
    seen.set(key, toCardDisplayCase(label));
    if (seen.size >= limit) break;
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

function collectionYear(
  collection: MarketplaceCollectionSummary,
): number | null {
  const comp = parseCollectionComponents(collection.components);
  const fromComp = yearFromComponents(comp);
  if (fromComp != null) return fromComp;
  const setLine =
    bucketCardSetForDisplay(comp).trim() ||
    collection.displayLabel?.trim() ||
    "";
  return setLine ? leadingYearFromSetLine(setLine) : null;
}

function cleanYearBound(raw: string): string {
  const t = raw.trim();
  if (!/^\d{4}$/.test(t)) return "";
  const y = Number(t);
  if (y < 1880 || y > 2100) return "";
  return t;
}

/** Ignore partial years. Swap when the lower year is after the upper year. */
export function normalizeMarketsYearInputs(
  minStr: string,
  maxStr: string,
): { min: string; max: string } {
  let min = cleanYearBound(minStr);
  let max = cleanYearBound(maxStr);
  if (min && max && Number(min) > Number(max)) {
    const swap = min;
    min = max;
    max = swap;
  }
  return { min, max };
}

export function collectionMatchesYearRange(
  collection: MarketplaceCollectionSummary,
  yearMinStr: string,
  yearMaxStr: string,
): boolean {
  const { min: a, max: b } = normalizeMarketsYearInputs(yearMinStr, yearMaxStr);
  if (!a && !b) return true;
  const year = collectionYear(collection);
  if (year == null) return false;
  if (a && year < Number(a)) return false;
  if (b && year > Number(b)) return false;
  return true;
}

export function collectionMatchesCharacterFilters(
  collection: MarketplaceCollectionSummary,
  selected: readonly string[],
): boolean {
  if (selected.length === 0) return true;
  const comp = parseCollectionComponents(collection.components);
  const hay = normalizeFacetToken(
    [
      bucketCardNameForDisplay(comp),
      comp.cardNameDisplay,
      comp.cardName,
      collection.displayLabel,
      collection.queryUsed,
    ]
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .join(" "),
  );
  if (!hay) return false;
  return selected.some((needle) => {
    const n = normalizeFacetToken(needle);
    return n.length > 0 && hay.includes(n);
  });
}

function collectionSetIdentityTokens(
  collection: MarketplaceCollectionSummary,
): string[] {
  const comp = parseCollectionComponents(collection.components);
  const parts = [
    resolveCollectionSetFacetLabel(comp),
    comp.normalizedPokemon?.setName,
    resolveCollectionSlabSetLine(comp),
    bucketCardSetForDisplay(comp),
    comp.cardSetDisplay,
    comp.cardSet,
    comp.psaBrand,
  ];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    if (typeof part !== "string" || !part.trim()) continue;
    const token = normalizeFacetToken(part);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}

export function collectionMatchesSetFilters(
  collection: MarketplaceCollectionSummary,
  selected: readonly string[],
): boolean {
  if (selected.length === 0) return true;
  const identities = collectionSetIdentityTokens(collection);
  if (identities.length === 0) return false;
  return selected.some((needle) =>
    setFacetNeedles(needle).some((n) => {
      if (!n) return false;
      if (identities.some((id) => id === n)) return true;
      // Short fragments ("ex") must match a whole set name, not every title.
      if (n.length < 3) return false;
      return identities.some((id) => id.includes(n));
    }),
  );
}

export function collectionMatchesSeriesFilters(
  collection: MarketplaceCollectionSummary,
  selected: readonly string[],
): boolean {
  if (selected.length === 0) return true;
  const comp = parseCollectionComponents(collection.components);
  const hay = normalizeFacetToken(
    [
      comp.normalizedPokemon?.series,
      extractLeadingTcgSeriesFromSetDisplay(bucketCardSetForDisplay(comp)),
      extractLeadingTcgSeriesFromSetDisplay(resolveCollectionSlabSetLine(comp)),
      extractLeadingTcgSeriesFromSetDisplay(comp.cardSetDisplay),
      extractLeadingTcgSeriesFromSetDisplay(comp.cardSet),
      extractLeadingTcgSeriesFromSetDisplay(collection.displayLabel),
      bucketCardSetForDisplay(comp),
      resolveCollectionSlabSetLine(comp),
      collection.displayLabel,
      collection.queryUsed,
    ]
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .join(" "),
  );
  if (!hay) return false;
  return selected.some((needle) => {
    const n = normalizeFacetToken(needle);
    return n.length > 0 && hay.includes(n);
  });
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
    characters?: readonly string[];
    series?: readonly string[];
    sets?: readonly string[];
    yearMin?: string;
    yearMax?: string;
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
    if (!collectionMatchesCharacterFilters(c, opts.characters ?? [])) return false;
    if (!collectionMatchesSeriesFilters(c, opts.series ?? [])) return false;
    if (!collectionMatchesSetFilters(c, opts.sets ?? [])) return false;
    if (!collectionMatchesYearRange(c, opts.yearMin ?? "", opts.yearMax ?? "")) {
      return false;
    }
    return true;
  });
}
