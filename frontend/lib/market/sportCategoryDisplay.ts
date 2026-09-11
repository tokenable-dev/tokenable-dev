/**
 * User-facing sport category labels. PSA / Cardhedger often use sport names
 * ("Basketball", "Baseball") while product badges use league names (NBA, MLB, …).
 *
 * Pokémon slabs often arrive as PSA **TCG Cards** or Cardhedger **TCG** — product
 * badges should read **Pokemon**, not a second TCG label beside Pokémon copy.
 */

/** PSA / Cardhedger / mint metadata → Pokémon (not generic TCG — One Piece also uses TCG). */
const POKEMON_TCG_CATEGORY_PATTERNS: ReadonlyArray<RegExp> = [
  /^pok[eé]mon(\s+cards?)?$/i,
];

const GENERIC_TCG_CATEGORY_PATTERNS: ReadonlyArray<RegExp> = [
  /^tcg(\s+cards?)?$/i,
  /^tcgcard(s)?$/i,
  /^trading\s+card(\s+game)?(\s+cards?)?$/i,
];

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

/** True when upstream category is Pokémon (not generic TCG). */
export function isPokemonTcgCategoryLabel(raw: string | null | undefined): boolean {
  const t = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!t) return false;
  return POKEMON_TCG_CATEGORY_PATTERNS.some((re) => re.test(t));
}

export function isGenericTcgCategoryLabel(raw: string | null | undefined): boolean {
  const t = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!t) return false;
  return GENERIC_TCG_CATEGORY_PATTERNS.some((re) => re.test(t));
}

export function formatSportCategoryDisplayLabel(
  raw: string | null | undefined,
): string {
  const t = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!t) return "";

  if (isPokemonTcgCategoryLabel(t)) return "Pokemon";
  if (isGenericTcgCategoryLabel(t)) return "TCG";

  const upper = t.toUpperCase();
  if (LEAGUE_ABBREVS.has(upper)) return upper;

  for (const [re, label] of SPORT_NAME_TO_DISPLAY) {
    if (re.test(t)) return label;
  }

  return t;
}
