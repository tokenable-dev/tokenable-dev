/**
 * Card display name — single source of truth for Line 1 / Line 2 formatting.
 * See docs/guides/card-display-name.md
 */

import { displayEditionLanguage } from "@/lib/marketplace/collectionEditionLanguage";
import { formatHeadlineCardNumber } from "@/lib/marketplace/collectionFullDetailsTitle";

export const CARD_DISPLAY_GRADE_RAW = "Raw";

export type CardDisplayNameMode =
  /** `{Name} · {Number} · {Grade}` */
  | "line1"
  /** Line 1 + full Line 2 */
  | "line1+line2"
  /** Line 1 + Line 2 (compact = same join rules today; truncation is CSS-phase) */
  | "line1+compactLine2"
  /** `{Name} · {Grade}` — order book / tight layouts */
  | "line1Abbrev"
  /** Both lines, no breadcrumb dedupe (notifications, share, email) */
  | "selfContained";

export type CardDisplayNameParts = {
  cardName: string | null;
  cardNumber: string | null;
  grade: string | null;
  year: string | null;
  setName: string | null;
  language: string | null;
  variant: string | null;
};

export type FormatCardDisplayNameOptions = {
  mode?: CardDisplayNameMode;
  /** Drop set segment on Line 2 (rare; default keeps full `{Year} · {Set} {Lang} · {Variant}`). */
  omitSetOnLine2?: boolean;
};

/** Join non-empty segments with spaced middot — never leaves dangling separators. */
export function joinCardDisplaySegments(
  segments: (string | null | undefined)[],
): string {
  return segments
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" · ");
}

/** Ungraded / unknown → `Raw`. Otherwise trimmed label as-is. */
export function resolveCardDisplayGrade(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  return t || CARD_DISPLAY_GRADE_RAW;
}

/** Long or raw catalog tokens → short codes (`EN`, `JP`, …). Unknown → null. */
export function formatCardDisplayLanguageShort(
  raw: string | null | undefined,
): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  if (/^(en|eng)$/i.test(t)) return "EN";
  if (/^(jp|ja)$/i.test(t)) return "JP";
  if (/^(kr|ko)$/i.test(t)) return "KR";
  if (/^(cn|zh)$/i.test(t)) return "CN";
  const normalized = displayEditionLanguage(t);
  if (!normalized) return null;
  if (/^english$/i.test(normalized)) return "EN";
  if (/^japanese$/i.test(normalized)) return "JP";
  if (/^korean$/i.test(normalized)) return "KR";
  if (/^chinese$/i.test(normalized)) return "CN";
  if (/^[A-Z]{2,3}$/.test(normalized)) return normalized.toUpperCase();
  return null;
}

/** Strip leading category prefix from a set line when breadcrumb already shows category. */
export function stripCategoryPrefixFromSet(
  setLine: string,
  categoryLabel: string | null | undefined,
): string {
  const set = setLine.trim();
  const cat = (categoryLabel ?? "").trim();
  if (!set || !cat) return set;
  const catRe = new RegExp(`^${escapeRegExp(cat)}\\b\\s*`, "i");
  if (catRe.test(set)) {
    const stripped = set.replace(catRe, "").trim();
    return stripped || set;
  }
  const yearMatch = /^(\d{4})\s+(.+)$/.exec(set);
  if (yearMatch) {
    const [, y, rest] = yearMatch;
    if (catRe.test(rest)) {
      const strippedRest = rest.replace(catRe, "").trim();
      if (strippedRest) return `${y} · ${strippedRest}`;
    }
  }
  return set;
}

function stripLeadingYearToken(raw: string): string {
  return raw
    .replace(/^\d{4}\s*·\s*/, "")
    .replace(/^\d{4}\s+/, "")
    .trim();
}

/**
 * Collection-detail breadcrumb current node:
 * `{Set} ({Language})` — no year. Language omitted when unknown.
 */
export function formatDetailBreadcrumbTrail(params: {
  year?: string | null;
  setLine?: string | null;
  setName?: string | null;
  categoryLabel?: string | null;
  language?: string | null;
}): string {
  const cat = params.categoryLabel?.trim() || "";
  const lang =
    formatCardDisplayLanguageShort(params.language) ??
    params.language?.trim() ??
    "";

  let set = params.setName?.trim() || "";
  if (!set) {
    const fromLine = params.setLine?.trim() || "";
    if (fromLine) {
      const stripped = cat
        ? stripCategoryPrefixFromSet(fromLine, cat)
        : fromLine;
      set = stripLeadingYearToken(stripped);
    }
  } else if (cat) {
    set = stripLeadingYearToken(stripCategoryPrefixFromSet(set, cat));
  }

  if (!set) return "";
  set = formatCardDisplaySetLabel(stripLeadingTcgSeriesFromSetDisplay(set));
  if (lang && !new RegExp(`\\(${escapeRegExp(lang)}\\)\\s*$`, "i").test(set)) {
    return `${set} (${lang})`;
  }
  return set;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Set display: hyphens → spaces; One Piece codes like `op13` → `OP13`. */
export function formatCardDisplaySetLabel(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  return t
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bop(?=\d)/gi, "OP");
}

function normalizeSetContainmentKey(raw: string): string {
  return raw.toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ").trim();
}

/** Drop leading catalog codes (`s6a`, `sv3.5`) so expansion can match PSA Brand text. */
function stripLeadingCatalogSetCode(raw: string): string {
  const stripped = raw.replace(/^[a-z]{1,4}\d+[a-z]?(?:\.\d+)?\s+/i, "").trim();
  return stripped || raw;
}

const TCG_LANGUAGE_PREFIX = /^(japanese|english|korean|chinese|jp|en|kr|cn)$/i;

function takeTcgFranchiseLanguagePrefix(brandTokens: string[]): string[] | null {
  if (brandTokens.length === 0) return null;
  const prefix: string[] = [];
  let i = 0;
  if (
    /^one$/i.test(brandTokens[0] ?? "") &&
    /^piece$/i.test(brandTokens[1] ?? "")
  ) {
    prefix.push(brandTokens[0], brandTokens[1]);
    i = 2;
  } else if (/^pok[eé]mon$/i.test(brandTokens[0] ?? "")) {
    prefix.push(brandTokens[0]);
    i = 1;
  } else {
    return null;
  }
  if (brandTokens[i] && TCG_LANGUAGE_PREFIX.test(brandTokens[i])) {
    prefix.push(brandTokens[i]);
  }
  return prefix;
}

/**
 * Display-only: when a catalog expansion (Cardhedger `setName` / RWA `card.set`)
 * is contained in PSA Brand, keep franchise + language from Brand and use the
 * catalog expansion — era/series words in Brand (e.g. Sword & Shield) stay off UI.
 * Does not mutate stored Brand. No hardcoded era replace. Sports / no match → Brand as-is.
 */
export function preferCatalogExpansionInBrandDisplay(
  psaBrandDisplay: string | null | undefined,
  catalogSetName: string | null | undefined,
): string {
  const brand = (psaBrandDisplay ?? "").trim();
  const catalogRaw = (catalogSetName ?? "").trim();
  if (!brand) return catalogRaw;
  if (!catalogRaw) return brand;

  const expansion = stripLeadingCatalogSetCode(catalogRaw);
  const brandKey = normalizeSetContainmentKey(brand);
  const candidates = [
    normalizeSetContainmentKey(catalogRaw),
    normalizeSetContainmentKey(expansion),
  ].filter((k, idx, arr) => k.length >= 2 && arr.indexOf(k) === idx);

  const contained = candidates.some(
    (key) => brandKey.includes(key) && key.length < brandKey.length,
  );
  if (!contained) return brand;

  const prefix = takeTcgFranchiseLanguagePrefix(brand.split(/\s+/).filter(Boolean));
  if (!prefix) return brand;

  return formatCardDisplaySetLabel([...prefix, expansion].join(" "));
}

function isSeriesWordToken(t: string | undefined): boolean {
  return Boolean(t && /^[A-Za-z][A-Za-z0-9']*$/.test(t));
}

/** `Word & Word …expansion` → drop the pair; empty leftover means the pair *is* the set. */
function dropLeadingAmpersandSeries(tokens: string[]): string[] | null {
  if (
    tokens.length >= 4 &&
    isSeriesWordToken(tokens[0]) &&
    tokens[1] === "&" &&
    isSeriesWordToken(tokens[2])
  ) {
    return tokens.slice(3);
  }
  return null;
}

/**
 * Display-only: after franchise + language (or language alone on breadcrumb),
 * a leading `Word & Word` with more tokens after it is the TCG series/era slot.
 * Drop that slot only when an expansion remains. No named-series list.
 */
export function stripLeadingTcgSeriesFromSetDisplay(
  setDisplay: string | null | undefined,
): string {
  const raw = (setDisplay ?? "").trim();
  if (!raw) return "";
  const tokens = raw.replace(/\s*&\s*/g, " & ").split(/\s+/).filter(Boolean);
  const prefix = takeTcgFranchiseLanguagePrefix(tokens);
  if (prefix) {
    const dropped = dropLeadingAmpersandSeries(tokens.slice(prefix.length));
    if (!dropped?.length) return formatCardDisplaySetLabel(raw);
    return formatCardDisplaySetLabel([...prefix, ...dropped].join(" "));
  }
  let lang: string[] = [];
  let rest = tokens;
  if (tokens[0] && TCG_LANGUAGE_PREFIX.test(tokens[0])) {
    lang = [tokens[0]];
    rest = tokens.slice(1);
  }
  const dropped = dropLeadingAmpersandSeries(rest);
  if (!dropped?.length) return formatCardDisplaySetLabel(raw);
  return formatCardDisplaySetLabel([...lang, ...dropped].join(" "));
}

/**
 * Line 2 / meta: drop TCG franchise + leading language (`One Piece`, `Pokemon Japanese`)
 * so the expansion remains (`OP13 Carrying On His Will`). Does not strip set codes like `OP13`.
 * Display-only.
 */
export function stripLeadingTcgFranchiseFromSetDisplay(
  setDisplay: string | null | undefined,
): string {
  const raw = (setDisplay ?? "").trim();
  if (!raw) return "";
  const tokens = raw.replace(/\s*&\s*/g, " & ").split(/\s+/).filter(Boolean);
  while (tokens[0] && /^\d{4}$/.test(tokens[0])) tokens.shift();
  let rest = tokens;
  const prefix = takeTcgFranchiseLanguagePrefix(tokens);
  if (prefix) rest = tokens.slice(prefix.length);
  else if (tokens[0] && TCG_LANGUAGE_PREFIX.test(tokens[0])) {
    rest = tokens.slice(1);
  }
  while (rest[0] && /^\d{4}$/.test(rest[0])) rest = rest.slice(1);
  const dropped = dropLeadingAmpersandSeries(rest);
  if (dropped) rest = dropped;
  if (!rest.length) return formatCardDisplaySetLabel(raw);
  return formatCardDisplaySetLabel(rest.join(" "));
}

/** Catalog expansion prefer, then structural series omit — display only. */
export function resolveCardDisplaySetName(
  psaBrandDisplay: string | null | undefined,
  catalogSetName?: string | null,
): string {
  return stripLeadingTcgSeriesFromSetDisplay(
    preferCatalogExpansionInBrandDisplay(psaBrandDisplay, catalogSetName),
  );
}

/** TCG set-code token (`sv2a`, `s6a`, `sv11w`) — not a pure number like `151`. */
function isCatalogSetCodeToken(t: string): boolean {
  return /^[a-z]{1,4}\d+[a-z]?(?:\.\d+)?$/i.test(t);
}

/**
 * Strip franchise, language, year, series slot, and catalog codes so only the
 * expansion identity remains. Display-only — does not mutate stored Brand.
 */
function stripSetIdentityNoise(raw: string): string {
  const spaced = raw.replace(/\s*&\s*/g, " & ");
  let tokens = spaced.split(/\s+/).filter(Boolean);
  while (tokens[0] && /^\d{4}$/.test(tokens[0])) tokens = tokens.slice(1);
  const prefix = takeTcgFranchiseLanguagePrefix(tokens);
  if (prefix) tokens = tokens.slice(prefix.length);
  else if (tokens[0] && TCG_LANGUAGE_PREFIX.test(tokens[0])) {
    tokens = tokens.slice(1);
  }
  const dropped = dropLeadingAmpersandSeries(tokens);
  if (dropped) tokens = dropped;
  while (tokens[0] && isCatalogSetCodeToken(tokens[0])) tokens = tokens.slice(1);
  while (
    tokens.length > 0 &&
    TCG_LANGUAGE_PREFIX.test(tokens[tokens.length - 1] ?? "")
  ) {
    tokens = tokens.slice(0, -1);
  }
  return tokens.join(" ").trim();
}

function removeCompletePhrase(haystack: string, needle: string): string | null {
  if (!haystack || !needle) return null;
  if (haystack === needle) return "";
  const re = new RegExp(`(?:^|\\s)${escapeRegExp(needle)}(?:\\s|$)`);
  if (!re.test(haystack)) return null;
  return haystack.replace(re, " ").replace(/\s+/g, " ").trim();
}

function variantKeysForSetDuplicateCheck(variantKey: string): string[] {
  const keys = [variantKey];
  const stripped = variantKey
    .replace(/[\s-]+vmax[\s-]*hyper$/i, "")
    .replace(/[\s-]+hyper(\s+rare)?$/i, "")
    .trim();
  if (stripped && stripped !== variantKey) keys.push(stripped);
  return keys;
}

function setIdentityIsOnlyVariantRepeat(setRaw: string, variantKey: string): boolean {
  const set = normalizeSetContainmentKey(setRaw);
  if (!set) return false;
  if (variantKey === set) return true;
  const expansion = stripSetIdentityNoise(set);
  if (expansion && variantKey === expansion) return true;
  const removed = removeCompletePhrase(set, variantKey);
  if (removed == null) return false;
  return !stripSetIdentityNoise(removed);
}

export type ShouldHideDuplicateVariantInput = {
  variant: string | null | undefined;
  displayedSetName?: string | null;
  psaBrand?: string | null;
  language?: string | null;
};

/**
 * Display-only: hide PSA Variety only when it restates the set / expansion name.
 * Real parallels (finish, treatment, insert, alternate art) stay visible even
 * when they share a product word with the set (e.g. Silver Prizm / Panini Prizm).
 *
 * Same intent as backend `psaVarietyIsBrandOrSetDuplicate`, plus leftover-expansion
 * so a catalog set line that appends a finish does not swallow Reverse Holo.
 * Does not mutate stored `psaVariety`. No named-variant list.
 */
export function shouldHideDuplicateVariant(
  input: ShouldHideDuplicateVariantInput,
): boolean {
  const v = normalizeSetContainmentKey(input.variant ?? "");
  if (!v) return false;
  if (!v.includes(" ") && v.length < 5) return false;

  const lang = formatCardDisplayLanguageShort(input.language);
  const candidates = [
    input.displayedSetName,
    input.psaBrand,
    lang ? `${input.displayedSetName ?? ""} ${lang}` : null,
  ];
  for (const raw of candidates) {
    for (const key of variantKeysForSetDuplicateCheck(v)) {
      if (setIdentityIsOnlyVariantRepeat(raw ?? "", key)) return true;
    }
  }
  return false;
}

/** @see shouldHideDuplicateVariant — two-arg form used by Line 2 / Details KV. */
export function isDisplayVariantDuplicateOfSet(
  variant: string | null | undefined,
  setName: string | null | undefined,
  opts?: Omit<ShouldHideDuplicateVariantInput, "variant" | "displayedSetName">,
): boolean {
  return shouldHideDuplicateVariant({
    variant,
    displayedSetName: setName,
    psaBrand: opts?.psaBrand,
    language: opts?.language,
  });
}

/** Line 2 / meta only — does not mutate stored variety fields. */
export function displayVariantIfNotSetDuplicate(
  variant: string | null | undefined,
  setName: string | null | undefined,
  opts?: Omit<ShouldHideDuplicateVariantInput, "variant" | "displayedSetName">,
): string | null {
  const t = (variant ?? "").trim();
  if (!t) return null;
  if (
    shouldHideDuplicateVariant({
      variant: t,
      displayedSetName: setName,
      psaBrand: opts?.psaBrand,
      language: opts?.language,
    })
  ) {
    return null;
  }
  return t;
}

function formatLine2SetLanguageChunk(
  setName: string | null | undefined,
  language: string | null | undefined,
): string {
  const raw = (setName ?? "").trim();
  const expansion = stripLeadingTcgFranchiseFromSetDisplay(raw);
  const set = formatCardDisplaySetLabel(
    expansion || stripLeadingTcgSeriesFromSetDisplay(raw),
  );
  const lang = formatCardDisplayLanguageShort(language) ?? language?.trim() ?? "";
  if (!set && !lang) return "";
  if (!lang) return set;
  if (!set) return lang;
  const setLower = set.toLowerCase();
  const langLower = lang.toLowerCase();
  if (setLower.endsWith(` ${langLower}`) || setLower.includes(` ${langLower} `)) {
    return set;
  }
  if (setLower.endsWith(langLower)) return set;
  return `${set} ${lang}`;
}

export function cardDisplayPartsFromAssetDetail(
  parts: {
    cardName?: string | null;
    cardNumber?: string | null;
    year?: string | null;
    setName?: string | null;
    language?: string | null;
    variety?: string | null;
  },
  grade?: string | null,
): CardDisplayNameParts {
  return {
    cardName: parts.cardName?.trim() || null,
    cardNumber: parts.cardNumber?.trim() || null,
    grade: grade?.trim() || null,
    year: parts.year?.trim() || null,
    setName: parts.setName?.trim() || null,
    language: parts.language?.trim() || null,
    variant: parts.variety?.trim() || null,
  };
}

export function formatCardDisplayLine1(
  parts: CardDisplayNameParts,
  opts?: { abbrev?: boolean },
): string {
  const grade = resolveCardDisplayGrade(parts.grade);
  const name = parts.cardName?.trim() || "";
  const number = formatHeadlineCardNumber(parts.cardNumber) ?? "";

  if (opts?.abbrev) {
    return joinCardDisplaySegments([name, grade]);
  }

  return joinCardDisplaySegments([name, number, grade]);
}

export function formatCardDisplayLine2(
  parts: CardDisplayNameParts,
  opts?: {
    omitSet?: boolean;
  },
): string {
  const year = parts.year?.trim() || "";
  const setChunk = opts?.omitSet
    ? ""
    : formatLine2SetLanguageChunk(parts.setName, parts.language);
  const variant = displayVariantIfNotSetDuplicate(
    parts.variant,
    parts.setName,
    { language: parts.language },
  );
  return joinCardDisplaySegments([year, setChunk, variant]);
}

export function formatCardDisplayName(
  parts: CardDisplayNameParts,
  opts: FormatCardDisplayNameOptions = {},
): {
  line1: string;
  line2: string | null;
  combined: string;
} {
  const mode = opts.mode ?? "line1";
  const line1 = formatCardDisplayLine1(parts, {
    abbrev: mode === "line1Abbrev",
  });

  const needsLine2 =
    mode === "line1+line2" ||
    mode === "line1+compactLine2" ||
    mode === "selfContained";

  const line2 = needsLine2
    ? formatCardDisplayLine2(parts, {
        omitSet: opts.omitSetOnLine2,
      })
    : null;

  const combined = joinCardDisplaySegments([
    line1,
    line2,
  ]);

  return { line1, line2: line2 || null, combined };
}

/** Hover / document title — Line 1 + Line 2 (self-contained). */
export function formatCardDisplayHoverTitle(
  parts: CardDisplayNameParts,
): string {
  return formatCardDisplayName(parts, { mode: "selfContained" }).combined;
}
