/**
 * User-facing sport category labels. PSA / Cardhedger often use "Basketball"
 * while product copy uses league names (NBA, MLB, …).
 */
export function formatSportCategoryDisplayLabel(
  raw: string | null | undefined,
): string {
  const t = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!t) return "";
  // PSA / catalog: "Basketball", "Basketball Card", "Basketball Cards", …
  if (/^basketball(\s+cards?)?$/i.test(t)) return "NBA";
  return t;
}
