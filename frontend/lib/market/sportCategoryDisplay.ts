/**
 * User-facing sport category labels. PSA / Cardhedger often use sport names
 * ("Basketball", "Baseball") while product badges use league names (NBA, MLB, …).
 */

/** Labels that should render as league acronyms (uppercase), not title case. */
const LEAGUE_ABBREVS = new Set([
  "NBA",
  "MLB",
  "NFL",
  "NHL",
  "MLS",
  "WNBA",
  "PGA",
  "UFC",
  "WWE",
  "NASCAR",
  "F1",
]);

/** PSA / catalog sport name → common badge label (league or sport shorthand). */
const SPORT_NAME_TO_DISPLAY: ReadonlyArray<[RegExp, string]> = [
  [/^basketball(\s+cards?)?$/i, "NBA"],
  [/^baseball(\s+cards?)?$/i, "MLB"],
  [/^football(\s+cards?)?$/i, "NFL"],
  [/^american\s+football(\s+cards?)?$/i, "NFL"],
  [/^hockey(\s+cards?)?$/i, "NHL"],
  [/^ice\s+hockey(\s+cards?)?$/i, "NHL"],
  [/^soccer(\s+cards?)?$/i, "Soccer"],
  [/^golf(\s+cards?)?$/i, "PGA"],
  [/^wrestling(\s+cards?)?$/i, "WWE"],
  [/^mma(\s+cards?)?$/i, "UFC"],
  [/^mixed\s+martial\s+arts(\s+cards?)?$/i, "UFC"],
  [/^auto\s+racing(\s+cards?)?$/i, "NASCAR"],
  [/^racing(\s+cards?)?$/i, "NASCAR"],
];

export function isSportCategoryLeagueDisplayLabel(label: string): boolean {
  return LEAGUE_ABBREVS.has(label.trim().toUpperCase());
}

export function formatSportCategoryDisplayLabel(
  raw: string | null | undefined,
): string {
  const t = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!t) return "";

  const upper = t.toUpperCase();
  if (LEAGUE_ABBREVS.has(upper)) return upper;

  for (const [re, label] of SPORT_NAME_TO_DISPLAY) {
    if (re.test(t)) return label;
  }

  return t;
}
