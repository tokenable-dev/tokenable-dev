import type { AssetDetailHeadlineParts } from "@/lib/marketplace/assetDetailHeadline";
import { formatSportCategoryDisplayLabel } from "@/lib/market";

function norm(s: string | null | undefined): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Drop Details rows already shown in the hero title or header badges. */
export function filterRedundantRwaDetailStatRows(
  rows: { label: string; value: string }[],
  headline: AssetDetailHeadlineParts,
  badges: { category: string | null; gradeLine: string | null },
): { label: string; value: string }[] {
  const cardName = norm(headline.cardName);
  const setName = norm(headline.setName);
  const year = norm(headline.year);
  const gradeLine = norm(badges.gradeLine);
  const category = norm(badges.category);

  return rows.filter((row) => {
    const v = norm(row.value);
    const label = row.label.trim().toLowerCase();

    if (label === "variant") return true;

    if ((label === "player" || label === "card name") && cardName) {
      if (v === cardName || cardName.includes(v) || v.includes(cardName)) return false;
    }
    if (label === "set" && setName) {
      if (v === setName || setName.includes(v) || v.includes(setName)) return false;
    }
    if (label === "grade" && gradeLine) {
      if (v === gradeLine || gradeLine.includes(v) || v.includes(gradeLine)) return false;
    }
    if (label === "year" && year && v === year) return false;
    if (label === "category" && category) {
      const formatted = norm(formatSportCategoryDisplayLabel(row.value));
      if (formatted === category || category.includes(formatted)) return false;
    }
    return true;
  });
}
