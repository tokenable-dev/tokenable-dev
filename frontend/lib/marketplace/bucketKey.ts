/**
 * Mirrors `backend/src/marketplace/bucket-key.util.ts` so the UI can know
 * which owned RWAs belong to a given marketplace collection.
 */

import {
  bucketGradeScoreFromPsaGradeInput,
  psaGradePolicyInputFromGraded,
} from "@/lib/market/psaGradePolicy";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";

export interface MarketBucketComponents {
  gradingCompany: string;
  /** Whitespace-collapsed grader label from metadata — UI only. */
  gradingCompanyDisplay?: string;
  cardName: string;
  cardNameDisplay?: string;
  cardSet: string;
  cardSetDisplay?: string;
  gradeScore: string;
  /** Optional split for PSA/DNA autograph slabs. */
  variantType?: "psa_dna";
  /** Normalized card # — part of bucket hash since v2. */
  cardNumber?: string;
  /** `base` or PSA Variety slug — separates parallels in v2 buckets. */
  marketParallelKey?: string;
  /** PSA TotalPopulation — not part of bucket hash */
  psaTotalPopulation?: number;
}

/** Must match backend `BUCKET_KEY_VERSION`. */
export const BUCKET_KEY_VERSION = 2;
const KEY_VERSION = BUCKET_KEY_VERSION;

function normalizePart(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function collapseWhitespaceOnly(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function primaryCardNumber(num: string): string {
  const t = num.replace(/^#/, "").trim();
  if (!t) return "";
  return t.split("/")[0].trim();
}

/** Mirrors backend `marketParallelKeyFromPsaVariety`. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function psaVarietyIsBrandOrSetDuplicate(
  psaVariety: string,
  brandOrSet: string | null | undefined,
): boolean {
  const v = psaVariety.trim().replace(/\s+/g, " ").toLowerCase();
  const b = String(brandOrSet ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (!v || !b) return false;
  if (v === b) return true;
  if (!v.includes(" ") && v.length < 5) return false;
  return new RegExp(`(?:^|\\s)${escapeRegExp(v)}(?:\\s|$)`).test(b);
}

function marketParallelKeyFromPsaVariety(
  psaVariety: string | null | undefined,
  brandOrSet?: string | null,
): string {
  const raw = String(psaVariety ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!raw) return "base";
  if (/^english$/i.test(raw) || /^japanese$/i.test(raw)) return "base";
  if (/^base(\s+cards?)?$/i.test(raw)) return "base";
  if (psaVarietyIsBrandOrSetDuplicate(raw, brandOrSet)) return "base";
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 96) || "base"
  );
}

function detectVariantType(graded: Record<string, unknown>): "psa_dna" | null {
  const identity = graded.identity as Record<string, unknown> | undefined;
  const variant = identity?.variant as Record<string, unknown> | undefined;
  const fromIdentity = String(variant?.variant_type ?? "")
    .trim()
    .toUpperCase();
  if (fromIdentity === "PSA_DNA") return "psa_dna";

  const psa = graded.psa as Record<string, unknown> | undefined;
  const labelType = String(psa?.labelType ?? "").trim();
  const category = String(psa?.category ?? "").trim();
  const autographGrade = String(psa?.autographGrade ?? "").trim();
  if (
    /PSA\s*\/\s*DNA|PSA\/DNA|\bDNA\b/i.test(labelType) ||
    /PSA\s*\/\s*DNA|PSA\/DNA|\bDNA\b/i.test(category) ||
    autographGrade.length > 0
  ) {
    return "psa_dna";
  }
  return null;
}

/** Parse `properties.graded` from Tokenable mint JSON (IPFS). */
export function extractBucketComponentsFromMetadata(
  meta: Record<string, unknown>
): MarketBucketComponents | null {
  const props = meta.properties as Record<string, unknown> | undefined;
  const graded = (props?.graded ?? meta.graded) as Record<string, unknown> | undefined;
  if (!graded || typeof graded !== "object") return null;

  const rawGradingCo = String(graded.gradingCompany ?? "").trim();
  const gradingCompany = normalizePart(rawGradingCo);
  const gradingCompanyDisplay = collapseWhitespaceOnly(rawGradingCo);
  const card = graded.card as Record<string, unknown> | undefined;
  const grade = graded.grade as Record<string, unknown> | undefined;
  const psa = graded.psa as Record<string, unknown> | undefined;

  const rawName = String(card?.name ?? "").trim();
  const rawSet = String(card?.set ?? "").trim();
  const rawNum =
    String(card?.number ?? "").trim() ||
    String(psa?.cardNumberHint ?? "").trim();
  const rawNameMerged = rawName || String(psa?.cardNameHint ?? "");
  const rawSetMerged = rawSet || String(psa?.setHint ?? "");
  const cardName = normalizePart(rawNameMerged);
  const cardSet = normalizePart(rawSetMerged);
  const cardNameDisplay = collapseWhitespaceOnly(rawNameMerged);
  const cardSetDisplayCollapse = collapseWhitespaceOnly(rawSetMerged);
  const cardNumber = rawNum ? normalizePart(primaryCardNumber(rawNum)) : "";

  let scoreVal: unknown = grade?.score;
  if (scoreVal == null || scoreVal === "") scoreVal = psa?.gradeScore;

  let gradeScore = normalizeGradeScore(scoreVal);
  if (!gradeScore) {
    const bucketGrade = bucketGradeScoreFromPsaGradeInput(
      psaGradePolicyInputFromGraded(graded),
    );
    if (bucketGrade) gradeScore = bucketGrade;
  }
  if (!gradingCompany || !cardName || !gradeScore) return null;

  const psaVarietyRaw = String(psa?.variety ?? psa?.Variety ?? "").trim();
  const brandOrSet = String(
    psa?.brand ?? psa?.Brand ?? psa?.setHint ?? rawSetMerged,
  ).trim();
  const marketParallelKey = marketParallelKeyFromPsaVariety(
    psaVarietyRaw,
    brandOrSet,
  );

  const out: MarketBucketComponents = {
    gradingCompany,
    cardName,
    cardSet,
    gradeScore,
    marketParallelKey,
    gradingCompanyDisplay,
    ...(cardNameDisplay ? { cardNameDisplay } : {}),
    ...(cardSetDisplayCollapse ? { cardSetDisplay: cardSetDisplayCollapse } : {}),
    ...(cardNumber ? { cardNumber } : {}),
  };
  const variantType = detectVariantType(graded);
  if (variantType) out.variantType = variantType;

  const pop = psa?.totalPopulation;
  if (typeof pop === "number" && Number.isFinite(pop) && pop >= 0) {
    out.psaTotalPopulation = Math.floor(pop);
  }

  return out;
}

function normalizeGradeScore(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) {
    return trimFloatString(v);
  }
  const n = parseFloat(String(v ?? "").replace(",", "."));
  if (Number.isNaN(n)) return "";
  return trimFloatString(n);
}

function trimFloatString(n: number): string {
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return String(n);
}

function normalizeCardNumberForBucketKey(num: string | undefined): string {
  const t = String(num ?? "")
    .replace(/^#/, "")
    .trim();
  if (!t) return "";
  return t.split("/")[0].trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Deterministic 64-char hex key — must match backend `computeMarketBucketKey`. */
export async function computeMarketBucketKey(
  components: MarketBucketComponents
): Promise<string> {
  const payload = JSON.stringify({
    v: KEY_VERSION,
    gradingCompany: components.gradingCompany,
    cardName: components.cardName,
    cardSet: components.cardSet,
    gradeScore: components.gradeScore,
    cardNumber: normalizeCardNumberForBucketKey(components.cardNumber),
    marketParallelKey:
      components.marketParallelKey?.trim().toLowerCase() || "base",
    ...(components.variantType ? { variantType: components.variantType } : {}),
  });
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function metadataMatchesCollectionKey(
  meta: Record<string, unknown> | null | undefined,
  collectionKey: string
): Promise<boolean> {
  if (!meta || !collectionKey?.trim()) return false;
  const c = extractBucketComponentsFromMetadata(meta);
  if (!c) return false;
  const k = await computeMarketBucketKey(c);
  return k.toLowerCase() === collectionKey.trim().toLowerCase();
}

/** Prefer IPFS/original casing from `*Display`; legacy rows fall back to normalized bucket fields. */
export function bucketTextForDisplay(primary: unknown, fallback: unknown): string {
  const p =
    typeof primary === "string" ? primary.trim().replace(/\s+/g, " ") : "";
  if (p) return p;
  return typeof fallback === "string" ? fallback.trim() : "";
}

export function bucketCardNameForDisplay(comp: CollectionComponents): string {
  return bucketTextForDisplay(comp.cardNameDisplay, comp.cardName);
}

export function bucketCardSetForDisplay(comp: CollectionComponents): string {
  return bucketTextForDisplay(comp.cardSetDisplay, comp.cardSet);
}

export function bucketGradingCompanyForDisplay(comp: CollectionComponents): string {
  return bucketTextForDisplay(comp.gradingCompanyDisplay, comp.gradingCompany);
}
