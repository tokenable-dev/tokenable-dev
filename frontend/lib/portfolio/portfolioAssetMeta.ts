import type { CollectionMarketPreview, RwaMetadata } from "@/lib/core";
import type { CollectionMarketSeries } from "@/lib/core";
import { formatSportCategoryDisplayLabel, parseGradeScoreNumber } from "@/lib/market";
import type { GradedCardMetadata } from "@/types/gradedCard";

function getGraded(meta: RwaMetadata | null): GradedCardMetadata | undefined {
  const g = meta?.properties?.graded;
  return g && typeof g === "object" ? (g as GradedCardMetadata) : undefined;
}

/** Bucket components for {@link resolveExternalMarketUsd} — matches collection detail `comp`. */
export function marketTierComponentsFromMetadata(
  meta: RwaMetadata | null,
): Record<string, unknown> | null {
  const g = getGraded(meta);
  if (!g) return null;
  const score = g.psa?.gradeScore ?? g.grade?.score;
  const gradingCompany =
    typeof g.gradingCompany === "string" && g.gradingCompany.trim()
      ? g.gradingCompany.trim()
      : g.psa != null
        ? "PSA"
        : "";
  return {
    gradingCompany,
    gradeScore:
      score != null && Number.isFinite(Number(score)) ? String(score) : undefined,
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
  if (g?.psa?.gradeScore != null) return parseGradeScoreNumber(String(g.psa.gradeScore));
  if (g?.grade?.score != null && Number.isFinite(g.grade.score))
    return parseGradeScoreNumber(String(g.grade.score));
  return null;
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
