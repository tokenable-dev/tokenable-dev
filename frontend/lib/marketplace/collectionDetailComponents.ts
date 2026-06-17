/**
 * Canonical type for the `components` JSONB column persisted in `marketplace_collections`.
 *
 * Fields are optional because the column is populated incrementally over the collection
 * lifecycle (listing → cover → Cardhedger enrichment → PSA snapshot). Consumers must
 * treat every field as potentially absent.
 *
 * Do NOT extend this with `Record<string, unknown>` — use the typed fields below.
 * Add new optional fields here when the backend starts persisting them.
 */
export interface CollectionComponents {
  // ── Bucket-key fields (normalized at listing time) ─────────────────────────
  cardName?: string;
  /** Original casing from IPFS metadata — prefer over `cardName` for display. */
  cardNameDisplay?: string;
  cardSet?: string;
  /** Original casing — prefer over `cardSet` for display. */
  cardSetDisplay?: string;
  gradingCompany?: string;
  /** Original casing — prefer over `gradingCompany` for display. */
  gradingCompanyDisplay?: string;
  /** Normalized grade score string, e.g. "10", "9", "auth". */
  gradeScore?: string;
  /** Normalized card number without leading `#`, e.g. "085". */
  cardNumber?: string;
  /** `"base"` or PSA Variety slug — separates parallels in v2 bucket keys. */
  marketParallelKey?: string;
  /** Set when the slab is a PSA/DNA autograph variant. */
  variantType?: "psa_dna";

  // ── Collection display fields ───────────────────────────────────────────────
  /** Parallel/edition variant label (e.g. "SILVER PRIZM"). */
  variant?: string;
  /** Card language hint (e.g. "Japanese"). */
  language?: string;
  /** Release year — may be stored as number or 4-digit string. */
  year?: number | string;
  /** Rarity label (e.g. "Holo Rare"). */
  rarity?: string;
  /** PSA slab Subject line — canonical card name as graded (matches physical label). */
  psaSubject?: string;
  /** PSA slab Brand / set line. */
  psaBrand?: string;
  /** PSA slab Variety (parallel). */
  psaVariety?: string;
  /** PSA issue year from cert mirror. */
  psaYear?: number | string;
  /** PSA grade category (e.g. "Pokemon"). */
  psaCategory?: string;
  /** PSA grade label text (e.g. "GEM MT"). */
  psaGradeLabel?: string;
  /** PSA grade description (qualifier context). */
  psaGradeDescription?: string;
  /** IPFS `metadata.name` persisted at listing time — used as in-grid display title. */
  listingDisplayTitle?: string;
  /** PSA TotalPopulation — enriched from PSA public snapshot (grade-specific; PSA 10 for most listings). */
  psaTotalPopulation?: number;
  /** PSA spec pop report — count graded PSA 10 for this card spec. */
  psaGrade10Population?: number;
  /** PSA spec pop report — total graded across all PSA grades for this spec. */
  psaSpecTotalPopulation?: number;
  /** PSA spec pop report — Grade1…Grade10 counts keyed by numeric string. */
  psaPopulationByGrade?: Partial<
    Record<"1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10", number>
  >;
  /** PSA website estimate USD — fallback when Cardhedger has no catalog match. */
  psaEstimateUsd?: number;

  // ── Cardhedger enrichment ───────────────────────────────────────────────────
  /** Cardhedger card ID resolved at listing/boot time. */
  cardhedgerCardId?: string | null;

  // ── Backend-populated fields ────────────────────────────────────────────────
  /** Trending slab image URL set by the backend trending job. */
  trendingSlabImageUrl?: string | null;
  /** PSA cert number hint — present when at least one listing in this bucket has a cert. */
  psaCertNumber?: string | null;
}

/**
 * Backward-compatible alias. New code should import `CollectionComponents` directly.
 * @deprecated Use `CollectionComponents` instead.
 */
export type CollectionDetailComponents = CollectionComponents;

/**
 * Parse a raw API `components` value into a typed `CollectionComponents` object.
 *
 * Performs field-by-field extraction so that only declared fields reach the UI layer.
 * Unknown fields from the backend are silently ignored — this is intentional: the parser
 * acts as the single crossing point between untyped JSON and the typed domain model.
 *
 * Runtime behaviour is identical to the previous blind-cast implementation: absent or
 * wrongly-typed fields surface as `undefined`.
 */

import { parsePsaPopulationByGrade } from "@/lib/market/psaPopulationByGrade";

export function parseCollectionComponents(raw: unknown): CollectionComponents {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;

  const str = (v: unknown): string | undefined =>
    typeof v === "string" ? v : undefined;
  const strOrNull = (v: unknown): string | null | undefined =>
    typeof v === "string" ? v : v === null ? null : undefined;
  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;

  const out: CollectionComponents = {};

  const cardName = str(r.cardName);
  if (cardName !== undefined) out.cardName = cardName;
  const cardNameDisplay = str(r.cardNameDisplay);
  if (cardNameDisplay !== undefined) out.cardNameDisplay = cardNameDisplay;

  const cardSet = str(r.cardSet);
  if (cardSet !== undefined) out.cardSet = cardSet;
  const cardSetDisplay = str(r.cardSetDisplay);
  if (cardSetDisplay !== undefined) out.cardSetDisplay = cardSetDisplay;

  const gradingCompany = str(r.gradingCompany);
  if (gradingCompany !== undefined) out.gradingCompany = gradingCompany;
  const gradingCompanyDisplay = str(r.gradingCompanyDisplay);
  if (gradingCompanyDisplay !== undefined) out.gradingCompanyDisplay = gradingCompanyDisplay;

  const gradeScore = str(r.gradeScore);
  if (gradeScore !== undefined) out.gradeScore = gradeScore;

  const cardNumber = str(r.cardNumber);
  if (cardNumber !== undefined) out.cardNumber = cardNumber;

  const marketParallelKey = str(r.marketParallelKey);
  if (marketParallelKey !== undefined) out.marketParallelKey = marketParallelKey;

  if (r.variantType === "psa_dna") out.variantType = "psa_dna";

  const variant = str(r.variant);
  if (variant !== undefined) out.variant = variant;

  const language = str(r.language);
  if (language !== undefined) out.language = language;

  if (typeof r.year === "number" || typeof r.year === "string") out.year = r.year as number | string;

  const rarity = str(r.rarity);
  if (rarity !== undefined) out.rarity = rarity;

  const psaSubject = str(r.psaSubject);
  if (psaSubject !== undefined) out.psaSubject = psaSubject;

  const psaBrand = str(r.psaBrand);
  if (psaBrand !== undefined) out.psaBrand = psaBrand;

  const psaVariety = str(r.psaVariety);
  if (psaVariety !== undefined) out.psaVariety = psaVariety;

  if (typeof r.psaYear === "number" || typeof r.psaYear === "string") {
    out.psaYear = r.psaYear as number | string;
  }

  const psaCategory = str(r.psaCategory);
  if (psaCategory !== undefined) out.psaCategory = psaCategory;

  const psaGradeLabel = str(r.psaGradeLabel);
  if (psaGradeLabel !== undefined) out.psaGradeLabel = psaGradeLabel;

  const psaGradeDescription = str(r.psaGradeDescription);
  if (psaGradeDescription !== undefined) out.psaGradeDescription = psaGradeDescription;

  const listingDisplayTitle = str(r.listingDisplayTitle);
  if (listingDisplayTitle !== undefined) out.listingDisplayTitle = listingDisplayTitle;

  const psaTotalPopulation = num(r.psaTotalPopulation);
  if (psaTotalPopulation !== undefined) out.psaTotalPopulation = psaTotalPopulation;

  const psaGrade10Population = num(r.psaGrade10Population);
  if (psaGrade10Population !== undefined) out.psaGrade10Population = psaGrade10Population;

  const psaSpecTotalPopulation = num(r.psaSpecTotalPopulation);
  if (psaSpecTotalPopulation !== undefined) out.psaSpecTotalPopulation = psaSpecTotalPopulation;

  const psaPopulationByGrade = parsePsaPopulationByGrade(r.psaPopulationByGrade);
  if (psaPopulationByGrade !== undefined) out.psaPopulationByGrade = psaPopulationByGrade;

  const psaEstimateUsd = num(r.psaEstimateUsd);
  if (psaEstimateUsd !== undefined) out.psaEstimateUsd = psaEstimateUsd;

  const cardhedgerCardId = strOrNull(r.cardhedgerCardId);
  if (cardhedgerCardId !== undefined) out.cardhedgerCardId = cardhedgerCardId;

  const trendingSlabImageUrl = strOrNull(r.trendingSlabImageUrl);
  if (trendingSlabImageUrl !== undefined) out.trendingSlabImageUrl = trendingSlabImageUrl;

  const psaCertNumber = strOrNull(r.psaCertNumber);
  if (psaCertNumber !== undefined) out.psaCertNumber = psaCertNumber;

  return out;
}

/** Backward-compatible alias. */
export const parseCollectionDetailComponents = parseCollectionComponents;
