/**
 * Card display name — single source of truth for Line 1 / Line 2 formatting.
 * See docs/guides/card-display-name.md
 */

import { displayEditionLanguage } from "@/lib/marketplace/collectionEditionLanguage";
import {
  formatHeadlineCardNumber,
  splitTcgCollectorNumber,
} from "@/lib/marketplace/collectionFullDetailsTitle";

export const CARD_DISPLAY_GRADE_RAW = "Raw";

/** True when a grade token is the forbidden `Raw` placeholder (case-insensitive). */
export function isCardDisplayRawGrade(
  raw: string | null | undefined,
): boolean {
  return /^raw$/i.test((raw ?? "").trim());
}

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
  /** Breadcrumb set node (cleaned) — when present, Line 2 drops matching set. */
  breadcrumbSetName?: string | null;
  /** Asset detail hero: Line 1 is `{Name} · {Number}` — grade lives below the title. */
  omitGrade?: boolean;
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

/**
 * Normalize a grade label for Line 1.
 * Spec: grade slot is never empty — unknown / empty / explicit `Raw` → `Raw`.
 * Certificate of Ownership and similar surfaces pass `omitGrade` to hide the slot.
 */
export function resolveCardDisplayGrade(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t || isCardDisplayRawGrade(t)) return CARD_DISPLAY_GRADE_RAW;
  return t;
}

/** Strip a trailing `· Raw` / `Raw` grade leak from stored titles. */
export function stripTrailingRawGradeLabel(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  return t
    .replace(/\s*[·•]\s*Raw\s*$/i, "")
    .replace(/\s+Raw\s*$/i, "")
    .trim();
}

/** Details KV — Card.html uses full names (`English`), not short codes. */
export function formatCardDisplayLanguageLong(
  raw: string | null | undefined,
): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  const short = formatCardDisplayLanguageShort(t);
  if (short === "EN") return "English";
  if (short === "JP") return "Japanese";
  if (short === "KR") return "Korean";
  if (short === "CN") return "Chinese";
  const normalized = displayEditionLanguage(t);
  if (normalized && /^(English|Japanese|Korean|Chinese)\b/.test(normalized)) {
    return normalized.split(" · ")[0] ?? normalized;
  }
  return normalized || t;
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



const BREADCRUMB_SET_LANGUAGE_TOKEN =
  /^(japanese|english|korean|chinese|jp|ja|en|eng|kr|ko|cn|zh)$/i;

/** PSA Brand noise: `SV2a-POKEMON CARD 151` → keep expansion (`151`). */
const BREADCRUMB_SET_NOISE_TOKEN = /^cards?$/i;

/**
 * Breadcrumb-only set-name cleaning: drop category / franchise / language /
 * catalog set codes / PSA "Card" noise so the set-name segment is expansion only.
 */
function cleanBreadcrumbSetNode(
  setDisplay: string,
  categoryLabel: string,
  languageShort: string | null,
): string {
  let spaced = setDisplay
    .replace(/-/g, " ")
    .replace(/\s*&\s*/g, " & ")
    .replace(/\s+/g, " ")
    .trim();
  if (!spaced) return "";

  if (categoryLabel) {
    const catPhrase = new RegExp(
      `(?:^|\\s)${escapeRegExp(categoryLabel)}(?:\\s|$)`,
      "ig",
    );
    spaced = spaced.replace(catPhrase, " ").replace(/\s+/g, " ").trim();
  }

  const rawTokens = spaced.split(/\s+/).filter(Boolean);
  const tokens: string[] = [];
  for (let i = 0; i < rawTokens.length; i++) {
    const t = rawTokens[i] ?? "";
    const next = rawTokens[i + 1] ?? "";
    if (/^one$/i.test(t) && /^piece$/i.test(next)) {
      i += 1;
      continue;
    }
    if (/^pok[eé]mon$/i.test(t)) continue;
    if (/^\d{4}$/.test(t)) continue;
    if (isCatalogSetCodeToken(t)) continue;
    if (BREADCRUMB_SET_LANGUAGE_TOKEN.test(t)) continue;
    if (BREADCRUMB_SET_NOISE_TOKEN.test(t)) continue;
    if (
      /^\((japanese|english|korean|chinese|jp|ja|en|eng|kr|ko|cn|zh)\)$/i.test(t)
    ) {
      continue;
    }
    if (
      languageShort &&
      new RegExp(`^\\(${escapeRegExp(languageShort)}\\)$`, "i").test(t)
    ) {
      continue;
    }
    let withoutParen = t.replace(
      /\((japanese|english|korean|chinese|jp|ja|en|eng|kr|ko|cn|zh)\)$/i,
      "",
    );
    if (languageShort) {
      withoutParen = withoutParen.replace(
        new RegExp(`\\(${escapeRegExp(languageShort)}\\)$`, "i"),
        "",
      );
    }
    if (!withoutParen || BREADCRUMB_SET_LANGUAGE_TOKEN.test(withoutParen)) {
      continue;
    }
    tokens.push(withoutParen);
  }

  // Drop TCG era/series (`Sword & Shield …`) only when an expansion remains.
  const dropped = dropLeadingAmpersandSeries(tokens);
  const finalTokens =
    dropped && dropped.length > 0 ? dropped : tokens;

  return formatCardDisplaySetLabel(finalTokens.join(" "));
}

/**
 * Display-only expansion name for Details Set + breadcrumb set-name segment:
 * strip category / franchise / language / catalog set codes / PSA `Card` noise.
 */
export function formatDetailExpansionSetName(params: {
  setName?: string | null;
  setLine?: string | null;
  categoryLabel?: string | null;
  language?: string | null;
}): string {
  const cat = params.categoryLabel?.trim() || "";
  const lang =
    formatCardDisplayLanguageShort(params.language) ??
    params.language?.trim() ??
    "";
  const raw = params.setName?.trim() || params.setLine?.trim() || "";
  if (!raw) return "";
  return cleanBreadcrumbSetNode(raw, cat, lang || null);
}

/**
 * First catalog set-code token in a Brand / set string (`SV2a`, `OP13`, …).
 */
export function extractCatalogSetCodeFromDisplay(
  raw: string | null | undefined,
): string {
  const spaced = (raw ?? "").replace(/-/g, " ").replace(/\s+/g, " ").trim();
  if (!spaced) return "";
  for (const token of spaced.split(/\s+/)) {
    if (isCatalogSetCodeToken(token)) {
      return formatCardDisplaySetLabel(token);
    }
  }
  return "";
}

/**
 * Collection-detail breadcrumb current (final) node:
 * `{SetCode} {SetName} ({Language})`
 *
 * - Set code uppercase, no `#`, no invented hyphens.
 * - Language parenthetical short code only; omit when unknown.
 * - No year / card name / card number.
 * - Category prefix already stripped from set name via {@link formatDetailExpansionSetName}.
 */
export function formatDetailBreadcrumbTrail(params: {
  year?: string | null;
  setLine?: string | null;
  setName?: string | null;
  setCode?: string | null;
  cardNumber?: string | null;
  categoryLabel?: string | null;
  language?: string | null;
}): string {
  const cat = params.categoryLabel?.trim() || "";
  const lang =
    formatCardDisplayLanguageShort(params.language) ??
    params.language?.trim() ??
    "";

  const setName = formatDetailExpansionSetName({
    setName: params.setName,
    setLine: params.setLine,
    categoryLabel: cat,
    language: lang || null,
  });
  const setCode =
    formatCardDisplaySetLabel(params.setCode) ||
    extractCatalogSetCodeFromDisplay(params.setLine) ||
    extractCatalogSetCodeFromDisplay(params.setName) ||
    "";

  let node = "";
  if (setCode && setName) {
    const nameWithoutCode = setName
      .replace(new RegExp(`^${escapeRegExp(setCode)}\\b\\s*`, "i"), "")
      .trim();
    node = nameWithoutCode ? `${setCode} ${nameWithoutCode}` : setCode;
  } else {
    node = setCode || setName;
  }
  if (!node) return "";
  if (lang) return `${node} (${lang})`;
  return node;
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

/** Brand / set line `Scarlet & Violet 151` → `Scarlet & Violet` when an expansion remains. */
export function extractLeadingTcgSeriesFromSetDisplay(
  setDisplay: string | null | undefined,
): string | null {
  const raw = (setDisplay ?? "").trim();
  if (!raw) return null;
  const tokens = raw.replace(/\s*&\s*/g, " & ").split(/\s+/).filter(Boolean);
  while (tokens[0] && /^\d{4}$/.test(tokens[0])) tokens.shift();
  const prefix = takeTcgFranchiseLanguagePrefix(tokens);
  const rest = prefix ? tokens.slice(prefix.length) : tokens;
  const dropped = dropLeadingAmpersandSeries(rest);
  if (!dropped?.length || dropped.length >= rest.length) return null;
  const seriesTokens = rest.slice(0, rest.length - dropped.length);
  const label = formatCardDisplaySetLabel(seriesTokens.join(" "));
  return label || null;
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

/**
 * Short language codes that leaked into a set string (`Svp EN Sv …`).
 * Full words (`English`) stay — sports names can include them.
 */
const SET_LANGUAGE_SHORT_TOKEN = /^(en|eng|jp|ja|kr|ko|cn|zh)$/i;

function pullShortLanguageTokensFromSet(setDisplay: string): {
  set: string;
  extractedLang: string | null;
} {
  const tokens = setDisplay.split(/\s+/).filter(Boolean);
  let extractedLang: string | null = null;
  const kept: string[] = [];
  for (const t of tokens) {
    if (!SET_LANGUAGE_SHORT_TOKEN.test(t)) {
      kept.push(t);
      continue;
    }
    extractedLang = formatCardDisplayLanguageShort(t) ?? extractedLang;
  }
  return {
    set: formatCardDisplaySetLabel(kept.join(" ")),
    extractedLang,
  };
}

function formatLine2SetLanguageChunk(
  setName: string | null | undefined,
  language: string | null | undefined,
): string {
  const raw = (setName ?? "").trim();
  const expansion = stripLeadingTcgFranchiseFromSetDisplay(raw);
  const setBase = formatCardDisplaySetLabel(
    expansion || stripLeadingTcgSeriesFromSetDisplay(raw),
  );
  const pulled = pullShortLanguageTokensFromSet(setBase);
  const lang =
    formatCardDisplayLanguageShort(language) ??
    language?.trim() ??
    pulled.extractedLang ??
    "";
  const set = pulled.set;
  if (!set && !lang) return "";
  if (!lang) return set;
  if (!set) return lang;
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
  opts?: { abbrev?: boolean; omitGrade?: boolean },
): string {
  const name = stripTrailingRawGradeLabel(parts.cardName) || "";
  const number =
    splitTcgCollectorNumber(parts.cardNumber).number ??
    formatHeadlineCardNumber(parts.cardNumber) ??
    "";

  if (opts?.omitGrade) {
    return joinCardDisplaySegments([name, number]);
  }

  const grade = resolveCardDisplayGrade(parts.grade);

  if (opts?.abbrev) {
    return joinCardDisplaySegments([name, grade]);
  }

  return joinCardDisplaySegments([name, number, grade]);
}

export function formatCardDisplayLine2(
  parts: CardDisplayNameParts,
  opts?: {
    omitSet?: boolean;
    /**
     * When breadcrumb already shows this set name (cleaned), drop the set
     * chunk from Line 2 so Year / Variant stay high-signal.
     */
    breadcrumbSetName?: string | null;
  },
): string {
  const year = parts.year?.trim() || "";
  let omitSet = Boolean(opts?.omitSet);
  if (!omitSet && opts?.breadcrumbSetName?.trim()) {
    const line2Set = formatCardDisplaySetLabel(
      stripLeadingTcgFranchiseFromSetDisplay(parts.setName ?? "") ||
        parts.setName,
    );
    const crumbSet = formatCardDisplaySetLabel(opts.breadcrumbSetName);
    if (
      line2Set &&
      crumbSet &&
      normalizeSetContainmentKey(line2Set) ===
        normalizeSetContainmentKey(crumbSet)
    ) {
      omitSet = true;
    }
  }
  const setChunk = omitSet
    ? ""
    : formatLine2SetLanguageChunk(parts.setName, parts.language);
  const variant = displayVariantIfNotSetDuplicate(
    parts.variant,
    parts.setName,
    { language: parts.language },
  );
  return joinCardDisplaySegments([year, setChunk, variant]);
}

/**
 * List-level collision resolver.
 * When multiple rows share the same Line 1, append the smallest differentiator
 * (Variant → Year → Set) to colliding rows only.
 */
export function resolveCardDisplayLine1Collisions(
  items: Array<{ id: string; parts: CardDisplayNameParts }>,
  opts?: { abbrev?: boolean; omitGrade?: boolean },
): Map<string, string> {
  const out = new Map<string, string>();
  const groups = new Map<string, typeof items>();

  for (const item of items) {
    const base = formatCardDisplayLine1(item.parts, opts);
    out.set(item.id, base);
    const list = groups.get(base);
    if (list) list.push(item);
    else groups.set(base, [item]);
  }

  for (const [base, group] of groups) {
    if (group.length < 2) continue;

    const pick = (
      kind: "variant" | "year" | "set",
    ): Map<string, string> | null => {
      const values = new Map<string, string>();
      for (const item of group) {
        let v = "";
        if (kind === "variant") v = (item.parts.variant ?? "").trim();
        else if (kind === "year") v = (item.parts.year ?? "").trim();
        else {
          v = formatCardDisplaySetLabel(
            stripLeadingTcgFranchiseFromSetDisplay(item.parts.setName ?? "") ||
              item.parts.setName,
          );
        }
        if (!v) return null;
        values.set(item.id, v);
      }
      const unique = new Set(values.values());
      if (unique.size < group.length) return null;
      return values;
    };

    const diffs =
      pick("variant") ?? pick("year") ?? pick("set") ?? null;
    if (!diffs) continue;
    for (const item of group) {
      const d = diffs.get(item.id);
      if (d) out.set(item.id, joinCardDisplaySegments([base, d]));
    }
  }

  return out;
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
    omitGrade: opts.omitGrade,
  });

  const needsLine2 =
    mode === "line1+line2" ||
    mode === "line1+compactLine2" ||
    mode === "selfContained";

  const line2 = needsLine2
    ? formatCardDisplayLine2(parts, {
        omitSet: opts.omitSetOnLine2,
        breadcrumbSetName: opts.breadcrumbSetName,
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
