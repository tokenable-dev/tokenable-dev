import type { CollectionMarketPreview, RwaMetadata } from "@/lib/core";
import type { CollectionMarketSeries } from "@/lib/core";
import { formatSportCategoryDisplayLabel, parseGradeScoreNumber } from "@/lib/market";
import {
  bucketGradeScoreFromPsaGradeInput,
  parseFiniteGradeScore,
  psaGradePolicyInputFromGraded,
} from "@/lib/market/psaGradePolicy";
import type { GradedCardMetadata } from "@/types/gradedCard";

function getGraded(meta: RwaMetadata | null): GradedCardMetadata | undefined {
  if (!meta) return undefined;
  const root = meta as RwaMetadata & { graded?: unknown };
  const props = meta.properties as Record<string, unknown> | undefined;
  const g = props?.graded ?? root.graded;
  return g && typeof g === "object" ? (g as GradedCardMetadata) : undefined;
}

function pickMetaString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return undefined;
}

function resolveGradingCompany(graded: GradedCardMetadata): string {
  if (typeof graded.gradingCompany === "string" && graded.gradingCompany.trim()) {
    return graded.gradingCompany.trim();
  }
  const psa = graded.psa as Record<string, unknown> | undefined;
  const company = pickMetaString(psa?.company);
  if (company) return company;
  const hasPsaSlab =
    psa != null &&
    Boolean(
      pickMetaString(
        psa.certNumber,
        psa.gradeScore,
        psa.gradeLabel,
        psa.gradeDescription,
      ) || graded.grade?.certNumber,
    );
  return hasPsaSlab ? "PSA" : "";
}

function gradeTraitsFromAttributes(meta: RwaMetadata | null): {
  company?: string;
  grade?: string;
} {
  let company: string | undefined;
  let grade: string | undefined;
  for (const a of meta?.attributes ?? []) {
    const trait = (a.trait_type ?? "").trim();
    const tl = trait.toLowerCase();
    const v = String(a.value ?? "").trim();
    if (!v) continue;
    if (/grading\s*company/i.test(tl) || tl === "grader") company = v;
    if (tl === "grade" || /^psa(\s|$)/i.test(trait)) grade = v;
  }
  return { company, grade };
}

function scoreStringFromMetadataName(name: string | undefined): string | undefined {
  if (!name?.trim()) return undefined;
  const m = name.trim().match(/\bPSA\s+(\d{1,2}(?:\.\d+)?)\s*$/i);
  return m?.[1];
}

function resolvePortfolioGradeScoreString(
  meta: RwaMetadata,
  graded: GradedCardMetadata | undefined,
  attrs: { company?: string; grade?: string },
): string | undefined {
  if (graded) {
    const policy = psaGradePolicyInputFromGraded(graded as unknown as Record<string, unknown>);
    const fromPolicy = bucketGradeScoreFromPsaGradeInput(policy);
    if (fromPolicy) return fromPolicy;
  }
  if (attrs.grade) {
    const fromAttr = bucketGradeScoreFromPsaGradeInput({
      gradingCompany: attrs.company ?? "PSA",
      gradeScore: attrs.grade,
    });
    if (fromAttr) return fromAttr;
    return attrs.grade.trim();
  }
  return scoreStringFromMetadataName(meta.name);
}

function formatScoreForGradeChip(scoreStr: string): string {
  return scoreStr === "auth" ? "AUTH" : scoreStr;
}

/** Portfolio table grade chip — mirrors RWA detail badge resolution. */
export function formatPortfolioGradeLabel(meta: RwaMetadata | null): string | null {
  if (!meta) return null;

  const attrs = gradeTraitsFromAttributes(meta);
  const graded = getGraded(meta);

  if (graded) {
    const company = resolveGradingCompany(graded) || attrs.company || "";
    const scoreStr = resolvePortfolioGradeScoreString(meta, graded, attrs);

    if (company && scoreStr) {
      return `${company} ${formatScoreForGradeChip(scoreStr)}`.trim();
    }

    const psa = graded.psa as Record<string, unknown> | undefined;
    const grade = graded.grade as Record<string, unknown> | undefined;
    const gradeLabel = pickMetaString(
      psa?.gradeLabel,
      typeof grade?.label === "string" ? grade.label : undefined,
    );
    if (gradeLabel) {
      if (/^psa\s/i.test(gradeLabel)) return gradeLabel.toUpperCase();
      if (company) return `${company} ${gradeLabel}`.trim();
      return gradeLabel;
    }

    if (scoreStr) {
      const display = formatScoreForGradeChip(scoreStr);
      return company ? `${company} ${display}`.trim() : display;
    }
  }

  if (attrs.company && attrs.grade) {
    return `${attrs.company} ${attrs.grade}`.trim();
  }
  if (attrs.grade) {
    const company = attrs.company || (/^\d/.test(attrs.grade) ? "PSA" : "");
    return company ? `${company} ${attrs.grade}`.trim() : attrs.grade;
  }
  if (attrs.company) return attrs.company;

  const fromName = scoreStringFromMetadataName(meta.name);
  if (fromName) return `PSA ${fromName}`;

  return null;
}

const PSA_SCORE_QUALIFIER: Record<string, string> = {
  "10": "Gem Mint",
  "9": "Mint",
  "8": "NM-MT",
  "7": "NM",
  "6": "EX-MT",
  "5": "EX",
  "4": "VG-EX",
  "3": "VG",
  "2": "GOOD",
  "1": "PR",
  auth: "Authentic",
};

function prettyGradeQualifier(raw: string): string | null {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (/gem\s*m(?:in)?t/i.test(t)) return "Gem Mint";
  if (/\bmint\b/i.test(t) && !/gem/i.test(t)) return "Mint";
  if (/nm\s*-?\s*mt/i.test(t)) return "NM-MT";
  if (/\bnm\b/i.test(t)) return "NM";
  return null;
}

/** Table subtitle under the card title — `PSA 10 · Gem Mint`. */
export function formatPortfolioGradeSubtitle(meta: RwaMetadata | null): string | null {
  const chip = formatPortfolioGradeLabel(meta);
  if (!chip) return null;

  const graded = getGraded(meta);
  const psa = graded?.psa as Record<string, unknown> | undefined;
  const grade = graded?.grade as Record<string, unknown> | undefined;
  const fromMeta = prettyGradeQualifier(
    pickMetaString(psa?.gradeDescription, psa?.gradeLabel, grade?.label) ?? "",
  );
  const attrs = gradeTraitsFromAttributes(meta);
  const score = meta
    ? resolvePortfolioGradeScoreString(meta, graded, attrs)
    : undefined;
  const fromScore = score ? PSA_SCORE_QUALIFIER[score] ?? null : null;
  const qualifier = fromMeta || fromScore;
  if (qualifier && !chip.toLowerCase().includes(qualifier.toLowerCase())) {
    return `${chip} · ${qualifier}`;
  }
  return chip;
}

/** Bucket components for {@link resolveExternalMarketUsd} — matches collection detail `comp`. */
export function marketTierComponentsFromMetadata(
  meta: RwaMetadata | null,
): Record<string, unknown> | null {
  const g = getGraded(meta);
  if (!g) return null;
  const attrs = gradeTraitsFromAttributes(meta);
  const policy = psaGradePolicyInputFromGraded(g as unknown as Record<string, unknown>);
  let gradeScore = bucketGradeScoreFromPsaGradeInput(policy);
  if (!gradeScore && attrs.grade) {
    gradeScore =
      bucketGradeScoreFromPsaGradeInput({
        gradingCompany: attrs.company ?? "PSA",
        gradeScore: attrs.grade,
      }) ?? attrs.grade.trim();
  }
  const gradingCompany =
    resolveGradingCompany(g) || attrs.company || (gradeScore ? "PSA" : "");
  if (!gradingCompany || !gradeScore) return null;
  return {
    gradingCompany,
    gradeScore,
  };
}

export function extractCategory(meta: RwaMetadata | null): string | null {
  const g = getGraded(meta);
  if (g?.psa?.category?.trim()) {
    return formatSportCategoryDisplayLabel(g.psa.category.trim());
  }

  if (!meta?.attributes) return null;
  const traitTypes = [
    "PSA Category",
    "Set",
    "Sport",
    "Category",
    "Product",
    "League",
    "Card Type",
  ];
  for (const tt of traitTypes) {
    const cat = meta.attributes.find((a) => a.trait_type === tt);
    if (cat?.value != null && String(cat.value).trim() !== "")
      return formatSportCategoryDisplayLabel(String(cat.value).trim());
  }
  return null;
}

export function gradeScoreFromMetadata(meta: RwaMetadata | null): number | null {
  const g = getGraded(meta);
  const attrs = gradeTraitsFromAttributes(meta);
  if (g) {
    const policy = psaGradePolicyInputFromGraded(g as unknown as Record<string, unknown>);
    const bucket = bucketGradeScoreFromPsaGradeInput(policy);
    if (bucket && bucket !== "auth") {
      const n = parseFiniteGradeScore(bucket);
      if (n != null) return n;
    }
  }
  if (attrs.grade) return parseGradeScoreNumber(attrs.grade);
  const fromName = scoreStringFromMetadataName(meta?.name);
  return fromName ? parseGradeScoreNumber(fromName) : null;
}

function finitePositiveUsd(n: number | null | undefined): boolean {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/**
 * Snapshot can fill My Assets USD without a live mint-preview.
 * Unmatched Cardhedger (e.g. Master Ball cert attached to Reverse Foil, then Variety-gated)
 * with no grade strip is a blank row until mint-preview runs.
 */
export function portfolioSnapshotCanPriceHoldings(
  series: CollectionMarketSeries | null | undefined,
): boolean {
  if (!series) return false;
  const preview = series.cardhedgerPreview;
  if (preview?.matched && preview.card) return true;
  const gp = series.gradePrices;
  if (
    finitePositiveUsd(gp?.psa10) ||
    finitePositiveUsd(gp?.psa9) ||
    finitePositiveUsd(gp?.raw)
  ) {
    return true;
  }
  return Boolean(
    series.allGradePrices?.some((e) => finitePositiveUsd(e.priceUsd)),
  );
}

/**
 * Prefer whichever preview actually matched; when both match, keep series (chart-aligned).
 */
export function pickPortfolioMarketPreview(
  series: CollectionMarketSeries | null | undefined,
  mintPv: CollectionMarketPreview | null | undefined,
): CollectionMarketPreview | null {
  const s = series?.cardhedgerPreview;
  const sOk = Boolean(s?.matched && s?.card);
  const mOk = Boolean(mintPv?.matched && mintPv?.card);
  if (sOk && mOk) return s!;
  if (sOk) return s!;
  if (mOk) return mintPv!;
  return s ?? mintPv ?? null;
}

export function holdingsSetName(meta: RwaMetadata | null): string | null {
  const g = getGraded(meta);
  if (g?.card?.set?.trim()) return g.card.set.trim();
  if (g?.psa?.category?.trim()) {
    return formatSportCategoryDisplayLabel(g.psa.category.trim());
  }
  const attrSet = meta?.attributes?.find(
    (a) => a.trait_type === "Set" || a.trait_type === "PSA Category",
  );
  if (attrSet?.value?.trim()) return attrSet.value.trim();
  return null;
}

export function formatSnapshotAxisLabel(snapshotDateKst: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(snapshotDateKst.trim());
  if (m) return `${Number(m[2])}/${Number(m[3])}`;
  return snapshotDateKst;
}
