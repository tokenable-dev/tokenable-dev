/**
 * Mirrors `backend/src/marketplace/bucket-key.util.ts` so the UI can know
 * which owned RWAs belong to a given marketplace collection.
 */

export interface MarketBucketComponents {
  gradingCompany: string;
  cardName: string;
  cardSet: string;
  gradeScore: string;
  /** PSA TotalPopulation — not part of bucket hash */
  psaTotalPopulation?: number;
}

const KEY_VERSION = 1;

function normalizePart(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Parse `properties.graded` from Tokenable mint JSON (IPFS). */
export function extractBucketComponentsFromMetadata(
  meta: Record<string, unknown>
): MarketBucketComponents | null {
  const props = meta.properties as Record<string, unknown> | undefined;
  const graded = (props?.graded ?? meta.graded) as Record<string, unknown> | undefined;
  if (!graded || typeof graded !== "object") return null;

  const gradingCompany = normalizePart(String(graded.gradingCompany ?? ""));
  const card = graded.card as Record<string, unknown> | undefined;
  const grade = graded.grade as Record<string, unknown> | undefined;
  const psa = graded.psa as Record<string, unknown> | undefined;

  const rawName = String(card?.name ?? "").trim();
  const rawSet = String(card?.set ?? "").trim();
  const cardName = normalizePart(rawName || String(psa?.cardNameHint ?? ""));
  const cardSet = normalizePart(rawSet || String(psa?.setHint ?? ""));

  let scoreVal: unknown = grade?.score;
  if (scoreVal == null || scoreVal === "") scoreVal = psa?.gradeScore;

  const gradeScore = normalizeGradeScore(scoreVal);
  if (!gradingCompany || !cardName || !gradeScore) return null;

  const out: MarketBucketComponents = {
    gradingCompany,
    cardName,
    cardSet,
    gradeScore,
  };

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
