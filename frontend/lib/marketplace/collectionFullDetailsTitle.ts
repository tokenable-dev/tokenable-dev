import {
  bucketCardNameForDisplay,
  bucketCardSetForDisplay,
} from "@/lib/marketplace/bucketKey";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";

export function leadingYearFromSetLine(setLineRaw: string): number | null {
  const m = /^\s*(\d{4})\b/.exec(setLineRaw);
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1880 && y <= 2100 ? y : null;
}

/** Set label for Details KV — year is its own row, so drop a leading catalog year prefix. */
export function stripLeadingYearFromSetLine(setLineRaw: string): string {
  const trimmed = setLineRaw.trim();
  if (!trimmed) return "";
  const y = leadingYearFromSetLine(trimmed);
  if (y == null) return trimmed;
  const stripped = trimmed.replace(new RegExp(`^\\s*${y}\\b\\s*`), "").trim();
  return stripped || trimmed;
}

/** Canonical set facet label from a resolved set line (Details + Markets `set=`). */
export function resolveCollectionSetFacetLabelFromLine(
  setLineRaw: string | null | undefined,
): string {
  const raw = setLineRaw?.trim() ?? "";
  if (!raw) return "";
  return stripLeadingYearFromSetLine(raw);
}

/** Title-style card name for the hero (e.g. `PIKACHU/GREY FELT HAT` → `Pikachu Grey Felt Hat`). */
export function formatCardNameForHeadline(raw: string): string {
  return toCardDisplayCase(raw);
}

/**
 * User-facing card copy — prefer title case over ALL CAPS.
 * Mixed-case input is preserved; ALL-CAPS / slug input is title-cased with common TCG acronyms kept.
 */
export function toCardDisplayCase(value: string | null | undefined): string {
  if (value == null) return "";
  const t = String(value).trim().replace(/\s+/g, " ");
  if (!t) return "";
  if (/[a-z]/.test(t)) return t;

  const acronyms = new Set([
    "psa",
    "dna",
    "bgs",
    "sgc",
    "cgc",
    "tag",
    "ex",
    "gx",
    "v",
    "vmax",
    "vstar",
    "en",
    "jp",
    "kr",
    "sir",
    "sar",
    "ur",
    "hr",
    "bsp",
  ]);

  return t
    .replace(/\/+/g, " ")
    .replace(/[_]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      const lower = w.toLowerCase();
      if (acronyms.has(lower)) {
        if (lower === "v") return "V";
        if (lower === "vmax") return "VMAX";
        if (lower === "vstar") return "VSTAR";
        return lower.toUpperCase();
      }
      if (/^#\d/.test(w)) return w;
      // Keep hyphenated tokens like EN-151 readable
      if (w.includes("-")) {
        return w
          .split("-")
          .map((part) => {
            const pl = part.toLowerCase();
            if (acronyms.has(pl)) return pl.toUpperCase();
            if (!part) return part;
            return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
          })
          .join("-");
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * @deprecated Prefer {@link toCardDisplayCase} for user-facing titles.
 * Kept for admin / legacy call sites that still want ALL CAPS.
 */
export function toCardDisplayUppercase(value: string | null | undefined): string {
  if (value == null) return "";
  const t = String(value).trim().replace(/\s+/g, " ");
  return t.length === 0 ? "" : t.toLocaleUpperCase("en-US");
}

/** Padded `#085` when numeric; otherwise `#` + trimmed token. */
export function formatHeadlineCardNumber(raw: string | undefined | null): string | null {
  const n = String(raw ?? "")
    .trim()
    .replace(/^#/, "");
  if (!n) return null;
  if (/^\d+$/.test(n)) {
    const v = parseInt(n, 10);
    if (Number.isFinite(v) && v >= 0) return `#${String(v).padStart(3, "0")}`;
  }
  return `#${n}`;
}

export function yearFromComponents(components: CollectionComponents): number | null {
  const yearRaw = components.year;
  if (typeof yearRaw === "number" && Number.isFinite(yearRaw)) {
    const y = yearRaw;
    return y >= 1880 && y <= 2100 ? y : null;
  }
  if (typeof yearRaw === "string" && /^\d{4}$/.test(yearRaw.trim())) {
    const y = Number(yearRaw.trim());
    return y >= 1880 && y <= 2100 ? y : null;
  }
  return null;
}

/**
 * Optional second line under the set name — catalog shorthand (BSP, collab, etc.).
 * Keeps the main layout (badges + title + set + chips); adds readable context only.
 */
export function buildCollectionHeadlineMetaStrip(params: {
  setLine: string | null;
  comp: CollectionComponents;
  marketPreview?: {
    card?: {
      setName?: string | null;
      variant?: string | null;
      setType?: string | null;
    } | null;
  } | null;
  displayLabel?: string | null;
}): string | null {
  const set =
    params.setLine?.trim() ||
    params.marketPreview?.card?.setName?.trim() ||
    bucketCardSetForDisplay(params.comp).trim();
  const variant =
    (typeof params.comp.variant === "string" ? params.comp.variant.trim() : "") ||
    (params.marketPreview?.card?.variant?.trim() ?? "");
  const setType = params.marketPreview?.card?.setType?.trim() ?? "";
  const listingTitle =
    typeof params.comp.listingDisplayTitle === "string"
      ? params.comp.listingDisplayTitle.trim()
      : "";
  /** NFT `name` is canonical for this bucket — skip Cardhedger `setType` (often a second full set name). */
  const skipCatalogSetTypeEcho = listingTitle.length > 0;
  const corpus = `${set} ${variant} ${params.displayLabel ?? ""}`;

  const parts: string[] = [];
  const setOrVariantNamesBlackStar =
    /\bblack\s*star\s*promo/i.test(set) || /\bblack\s*star\s*promo/i.test(variant);
  if (!setOrVariantNamesBlackStar && /\bblack\s*star\s*promo/i.test(corpus)) {
    parts.push("BSP");
  }

  if (/\bvan\s*gogh\b/i.test(corpus)) {
    const inSet = /\bvan\s*gogh\b/i.test(set);
    if (!inSet) {
      parts.push(/\bpokemon\b/i.test(corpus) ? "Pokemon × Van Gogh" : "Van Gogh");
    }
  }
  if (
    !skipCatalogSetTypeEcho &&
    setType &&
    !tagFragmentContainedInLine(setType, set) &&
    !tagFragmentContainedInLine(setType, variant)
  ) {
    parts.push(setType);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

function tagFragmentContainedInLine(fragment: string, lineRaw: string): boolean {
  const f = fragment.trim().toLowerCase().replace(/\s+/g, " ");
  const line = lineRaw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!f || !line) return false;
  if (line.includes(f)) return true;
  return f.length >= 10 && line.length >= 10 && (line.includes(f.slice(0, 12)) || f.includes(line));
}

/** Prefer IPFS display name, formatted for reading when it looks like a bucket slug. */
export function formatCollectionHeroCardTitle(comp: CollectionComponents): string {
  const raw = bucketCardNameForDisplay(comp).trim();
  if (!raw) return "";
  const looksSlug =
    raw === raw.toUpperCase() ||
    /[/_]/.test(raw) ||
    (raw.split(/\s+/).length <= 4 && raw.length >= 8 && raw === raw.toUpperCase());
  return looksSlug ? formatCardNameForHeadline(raw) : raw;
}

/**
 * One-line collection name for `title` / sr-only: card · set · meta · # · Pop — avoids repeating BSP / Van Gogh when already in set or meta.
 */
export function computeCollectionWovenTitle(
  cardTitle: string,
  setLine: string | null,
  metaStrip: string | null,
  cardNumber: string | null,
  populationBadge: string | null,
): string {
  const chunks: string[] = [];
  const t = cardTitle.trim();
  const s = (setLine ?? "").trim();
  if (t) chunks.push(t);
  if (s) chunks.push(s);
  const m = (metaStrip ?? "").trim();
  if (m) {
    const hay = `${t} ${s}`.toLowerCase();
    if (!hay.includes(m.toLowerCase())) chunks.push(m);
  }
  const num = (cardNumber ?? "").trim();
  if (num) {
    const digits = num.replace(/^#/, "");
    const joined = chunks.join(" ").toLowerCase();
    if (!joined.includes(digits)) chunks.push(num);
  }
  const pop = (populationBadge ?? "").trim();
  if (pop && !chunks.join(" ").toLowerCase().includes("pop ·")) chunks.push(pop);
  return chunks.join(" · ");
}
