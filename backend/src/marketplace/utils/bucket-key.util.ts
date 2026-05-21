import { createHash } from 'crypto';
import {
  bucketGradeScoreFromPsaGradeInput,
  psaGradePolicyInputFromGraded,
} from './psa-grade-policy.util';

/** Canonical fields that define a "same card" pool (many tokenIds, one book). */
export interface MarketBucketComponents {
  /** Lowercase-normalized grader key for hashing; presentation uses {@link gradingCompanyDisplay}. */
  gradingCompany: string;
  /** As in metadata (whitespace collapsed) — UI only; not in bucket hash. */
  gradingCompanyDisplay?: string;
  /** Lowercase-normalized card title for hashing / matching — UI uses {@link cardNameDisplay}. */
  cardName: string;
  /** As in metadata (whitespace collapsed) — UI only. */
  cardNameDisplay?: string;
  /** Lowercase-normalized set name — UI uses {@link cardSetDisplay}. */
  cardSet: string;
  /** As in metadata when non-empty — UI only. */
  cardSetDisplay?: string;
  /** Numeric grade as stable string, e.g. "10", "9.5". */
  gradeScore: string;
  /**
   * Optional market variant split. Currently used to isolate PSA/DNA-autograph slabs
   * from regular PSA-graded cards so they do not share one collection pool.
   */
  variantType?: 'psa_dna';
  /**
   * PSA TotalPopulation for this cert line (same for all RWAs in the bucket). Not part of the bucket hash.
   */
  psaTotalPopulation?: number;
  /**
   * Optional card # (e.g. 086) — **not** part of {@link computeMarketBucketKey}; used for search matching only.
   */
  cardNumber?: string;
}

const KEY_VERSION = 1;

function normalizePart(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Trim + collapse internal whitespace — preserves casing for display fields only. */
function collapseWhitespaceOnly(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

function detectVariantType(graded: Record<string, unknown>): 'psa_dna' | null {
  const identity = graded.identity as Record<string, unknown> | undefined;
  const variant = identity?.variant as Record<string, unknown> | undefined;
  const fromIdentity = String(variant?.variant_type ?? '')
    .trim()
    .toUpperCase();
  if (fromIdentity === 'PSA_DNA') return 'psa_dna';

  const psa = graded.psa as Record<string, unknown> | undefined;
  const labelType = String(psa?.labelType ?? '').trim();
  const category = String(psa?.category ?? '').trim();
  const autographGrade = String(psa?.autographGrade ?? '').trim();
  if (
    /PSA\s*\/\s*DNA|PSA\/DNA|\bDNA\b/i.test(labelType) ||
    /PSA\s*\/\s*DNA|PSA\/DNA|\bDNA\b/i.test(category) ||
    autographGrade.length > 0
  ) {
    return 'psa_dna';
  }
  return null;
}

/** Where the coalesced `graded` payload came from (`properties.graded ?? meta.graded`). */
export type GradedBlockSource = 'properties.graded' | 'root.graded' | 'none';

export type BucketExtractDiagnosis =
  | {
      ok: true;
      components: MarketBucketComponents;
      gradedSource: Exclude<GradedBlockSource, 'none'>;
    }
  | {
      ok: false;
      code:
        | 'no_graded_object'
        | 'missing_grading_company'
        | 'missing_card_name'
        | 'missing_grade_score';
      gradedSource: GradedBlockSource;
      detail: Record<string, unknown>;
    };

/** Shallow shape for logs (no full IPFS payload). */
export function metaShapeSampleForBucketLog(
  meta: Record<string, unknown>,
): Record<string, unknown> {
  const props = meta.properties as Record<string, unknown> | undefined;
  const graded = (props?.graded ?? meta.graded) as
    | Record<string, unknown>
    | undefined;
  const sample: Record<string, unknown> = {
    metaTopKeys: Object.keys(meta).slice(0, 32),
    hasPropertiesObject: Boolean(props && typeof props === 'object'),
    propertiesKeys:
      props && typeof props === 'object' ? Object.keys(props).slice(0, 32) : [],
    hasPropertiesGradedKey: props != null && 'graded' in props,
    hasRootGradedKey: 'graded' in meta,
    gradedJsType:
      graded === undefined
        ? 'undefined'
        : graded === null
          ? 'null'
          : typeof graded,
  };
  if (graded && typeof graded === 'object') {
    sample.gradedChildKeys = Object.keys(graded).slice(0, 32);
    sample.gradedHasCardObject = Boolean(
      graded.card && typeof graded.card === 'object',
    );
    sample.gradedHasGradeObject = Boolean(
      graded.grade && typeof graded.grade === 'object',
    );
    sample.gradedHasPsaObject = Boolean(
      graded.psa && typeof graded.psa === 'object',
    );
  }
  return sample;
}

/**
 * Same rules as {@link extractBucketComponentsFromMetadata} but returns a structured
 * diagnosis when extraction fails (pipeline logging / support).
 */
export function extractOrDiagnoseBucketComponents(
  meta: Record<string, unknown>,
): BucketExtractDiagnosis {
  const props = meta.properties as Record<string, unknown> | undefined;
  const chosen = props?.graded ?? meta.graded;
  const gradedSource: GradedBlockSource =
    chosen != null && chosen === props?.graded
      ? 'properties.graded'
      : chosen != null && chosen === meta.graded
        ? 'root.graded'
        : 'none';

  const graded = chosen as Record<string, unknown> | undefined;
  if (!graded || typeof graded !== 'object') {
    return {
      ok: false,
      code: 'no_graded_object',
      gradedSource,
      detail: {
        ...metaShapeSampleForBucketLog(meta),
        note: 'Expected object at properties.graded or root graded (Tokenable mint JSON).',
      },
    };
  }

  const rawGradingCo = String(graded.gradingCompany ?? '').trim();
  const gradingCompany = normalizePart(rawGradingCo);
  const gradingCompanyDisplay = collapseWhitespaceOnly(rawGradingCo);
  const card = graded.card as Record<string, unknown> | undefined;
  const grade = graded.grade as Record<string, unknown> | undefined;
  const psa = graded.psa as Record<string, unknown> | undefined;

  const rawName = String(card?.name ?? '').trim();
  const rawSet = String(card?.set ?? '').trim();
  const rawNum =
    String(card?.number ?? '').trim() ||
    String(psa?.cardNumberHint ?? '').trim();
  const rawNameMerged = rawName || String(psa?.cardNameHint ?? '');
  const rawSetMerged = rawSet || String(psa?.setHint ?? '');
  const cardName = normalizePart(rawNameMerged);
  const cardSet = normalizePart(rawSetMerged);
  const cardNameDisplay = collapseWhitespaceOnly(rawNameMerged);
  const cardSetDisplayCollapse = collapseWhitespaceOnly(rawSetMerged);
  const cardNumber = rawNum ? normalizePart(rawNum) : '';

  let scoreVal: unknown = grade?.score;
  if (scoreVal == null || scoreVal === '') scoreVal = psa?.gradeScore;

  let gradeScore = normalizeGradeScore(scoreVal);
  if (!gradeScore) {
    const bucketGrade = bucketGradeScoreFromPsaGradeInput(
      psaGradePolicyInputFromGraded(graded),
    );
    if (bucketGrade) gradeScore = bucketGrade;
  }

  if (!gradingCompany) {
    return {
      ok: false,
      code: 'missing_grading_company',
      gradedSource,
      detail: {
        ...metaShapeSampleForBucketLog(meta),
        rawGradingCompany: graded.gradingCompany,
      },
    };
  }
  if (!cardName) {
    return {
      ok: false,
      code: 'missing_card_name',
      gradedSource,
      detail: {
        ...metaShapeSampleForBucketLog(meta),
        rawCardName: card?.name,
        psaCardNameHint: psa?.cardNameHint,
      },
    };
  }
  if (!gradeScore) {
    return {
      ok: false,
      code: 'missing_grade_score',
      gradedSource,
      detail: {
        ...metaShapeSampleForBucketLog(meta),
        gradeScoreField: grade?.score,
        psaGradeScoreField: psa?.gradeScore,
      },
    };
  }

  const out: MarketBucketComponents = {
    gradingCompany,
    cardName,
    cardSet,
    gradeScore,
    gradingCompanyDisplay,
    ...(cardNameDisplay ? { cardNameDisplay } : {}),
    ...(cardSetDisplayCollapse
      ? { cardSetDisplay: cardSetDisplayCollapse }
      : {}),
  };
  const variantType = detectVariantType(graded);
  if (variantType) out.variantType = variantType;
  if (cardNumber) out.cardNumber = cardNumber;

  const pop = psa?.totalPopulation;
  if (typeof pop === 'number' && Number.isFinite(pop) && pop >= 0) {
    out.psaTotalPopulation = Math.floor(pop);
  }

  return {
    ok: true,
    components: out,
    gradedSource: gradedSource as Exclude<GradedBlockSource, 'none'>,
  };
}

/** Parse `properties.graded` from Tokenable mint JSON (IPFS). */
export function extractBucketComponentsFromMetadata(
  meta: Record<string, unknown>,
): MarketBucketComponents | null {
  const r = extractOrDiagnoseBucketComponents(meta);
  return r.ok ? r.components : null;
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
export function computeMarketBucketKey(
  components: MarketBucketComponents,
): string {
  const payload = JSON.stringify({
    v: KEY_VERSION,
    gradingCompany: components.gradingCompany,
    cardName: components.cardName,
    cardSet: components.cardSet,
    gradeScore: components.gradeScore,
    ...(components.variantType ? { variantType: components.variantType } : {}),
  });
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}
