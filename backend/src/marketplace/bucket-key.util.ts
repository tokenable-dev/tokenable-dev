import { createHash } from 'crypto';

/** Canonical fields that define a "same card" pool (many tokenIds, one book). */
export interface MarketBucketComponents {
  gradingCompany: string;
  cardName: string;
  /** Normalized set name (may be empty). */
  cardSet: string;
  /** Numeric grade as stable string, e.g. "10", "9.5". */
  gradeScore: string;
}

const KEY_VERSION = 1;

function normalizePart(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Parse `properties.graded` from Tokenable mint JSON (IPFS). */
export function extractBucketComponentsFromMetadata(
  meta: Record<string, unknown>,
): MarketBucketComponents | null {
  const props = meta.properties as Record<string, unknown> | undefined;
  const graded = (props?.graded ?? meta.graded) as Record<string, unknown> | undefined;
  if (!graded || typeof graded !== 'object') return null;

  const gradingCompany = normalizePart(String(graded.gradingCompany ?? ''));
  const card = graded.card as Record<string, unknown> | undefined;
  const grade = graded.grade as Record<string, unknown> | undefined;
  const psa = graded.psa as Record<string, unknown> | undefined;

  const rawName = String(card?.name ?? '').trim();
  const rawSet = String(card?.set ?? '').trim();
  const cardName = normalizePart(rawName || String(psa?.cardNameHint ?? ''));
  const cardSet = normalizePart(rawSet || String(psa?.setHint ?? ''));

  let scoreVal: unknown = grade?.score;
  if (scoreVal == null || scoreVal === '') scoreVal = psa?.gradeScore;

  const gradeScore = normalizeGradeScore(scoreVal);
  if (!gradingCompany || !cardName || !gradeScore) return null;

  return {
    gradingCompany,
    cardName,
    cardSet,
    gradeScore,
  };
}

function normalizeGradeScore(v: unknown): string {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return trimFloatString(v);
  }
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  if (Number.isNaN(n)) return '';
  return trimFloatString(n);
}

function trimFloatString(n: number): string {
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return String(n);
}

/** Deterministic 64-char hex key shared by backend and frontend. */
export function computeMarketBucketKey(components: MarketBucketComponents): string {
  const payload = JSON.stringify({
    v: KEY_VERSION,
    gradingCompany: components.gradingCompany,
    cardName: components.cardName,
    cardSet: components.cardSet,
    gradeScore: components.gradeScore,
  });
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}
