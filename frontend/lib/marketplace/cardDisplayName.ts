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
  set = formatCardDisplaySetLabel(set);
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

/**
 * Display-only: PSA Variety that repeats the expansion / set name (phrase inside set).
 * Same meaning as backend `psaVarietyIsBrandOrSetDuplicate` — not imported from backend.
 * Short single tokens (RED, GOLD) stay visible as parallels.
 */
export function isDisplayVariantDuplicateOfSet(
  variant: string | null | undefined,
  setName: string | null | undefined,
): boolean {
  const v = normalizeSetContainmentKey(variant ?? "");
  const set = normalizeSetContainmentKey(setName ?? "");
  if (!v || !set) return false;
  if (v === set) return true;
  if (!v.includes(" ") && v.length < 5) return false;
  const phrase = new RegExp(`(?:^|\\s)${escapeRegExp(v)}(?:\\s|$)`);
  return phrase.test(set);
}

/** Line 2 / meta only — does not mutate stored variety fields. */
export function displayVariantIfNotSetDuplicate(
  variant: string | null | undefined,
  setName: string | null | undefined,
): string | null {
  const t = (variant ?? "").trim();
  if (!t) return null;
  if (isDisplayVariantDuplicateOfSet(t, setName)) return null;
  return t;
}

function formatLine2SetLanguageChunk(
  setName: string | null | undefined,
  language: string | null | undefined,
): string {
  const set = formatCardDisplaySetLabel(setName);
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
