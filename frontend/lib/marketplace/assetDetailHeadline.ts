import {
  formatHeadlineCardNumber,
  leadingYearFromSetLine,
  toCardDisplayUppercase,
} from "@/lib/marketplace/collectionFullDetailsTitle";
import { mergeHeadlineCardNumberIntoTitle } from "@/lib/marketplace/collectionHeadlineTags";
import { displayAssetNameFromMetadata } from "@/lib/marketplace/rwaDisplayTitle";

export type AssetDetailHeadlineParts = {
  year: string | null;
  setName: string | null;
  cardName: string | null;
};

function pickString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return undefined;
}

function normalizeYear(year: number | string | null | undefined): number | null {
  if (year == null) return null;
  if (typeof year === "number" && Number.isFinite(year)) {
    const y = Math.trunc(year);
    return y >= 1880 && y <= 2100 ? y : null;
  }
  const s = String(year).trim();
  // Sometimes year comes as a larger string (e.g. "2024 - set", "Year: 2023").
  const m = /(\d{4})/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1880 && y <= 2100 ? y : null;
}

function applyHeadlineCasing(value: string, uppercase: boolean): string {
  const t = value.trim();
  if (!t) return "";
  return uppercase ? toCardDisplayUppercase(t) : t;
}

function extractYearFromText(lineRaw: string | null | undefined): number | null {
  const line = lineRaw?.trim();
  if (!line) return null;
  const m = /(\d{4})/.exec(line);
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1880 && y <= 2100 ? y : null;
}

/**
 * Collection / card detail hero: Year → set name → card name (optional `#` on card segment).
 */
export function buildAssetDetailHeadlineParts(input: {
  setLine?: string | null;
  year?: number | string | null;
  cardName?: string | null;
  cardNumber?: string | null;
  uppercase?: boolean;
}): AssetDetailHeadlineParts {
  const uppercase = input.uppercase ?? false;
  const setRaw = (input.setLine ?? "").trim();
  const explicitYear = normalizeYear(input.year);

  let yearOut: string | null = null;
  let setOut: string | null = null;

  if (setRaw) {
    const yFromSet =
      // Prefer canonical "year at start" extraction, but fall back to "year anywhere".
      leadingYearFromSetLine(setRaw) ?? extractYearFromText(setRaw);
    const y = yFromSet ?? explicitYear;
    if (y != null) yearOut = String(y);
    const withoutYear =
      y != null
        ? setRaw.replace(new RegExp(`\\b${String(y)}\\b`), "").trim()
        : setRaw;
    setOut = withoutYear || (y != null ? setRaw : setRaw);
  } else if (explicitYear != null) {
    yearOut = String(explicitYear);
  }

  let card = (input.cardName ?? "").trim();
  const num = formatHeadlineCardNumber(input.cardNumber);
  if (num) card = mergeHeadlineCardNumberIntoTitle(card, num);

  return {
    year: yearOut ? applyHeadlineCasing(yearOut, uppercase) : null,
    setName: setOut ? applyHeadlineCasing(setOut, uppercase) : null,
    cardName: card ? applyHeadlineCasing(card, uppercase) : null,
  };
}

/** Space-separated hero line (Year Set Card). */
export function formatAssetDetailHeadlineText(parts: AssetDetailHeadlineParts): string {
  return [parts.year, parts.setName, parts.cardName]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s))
    .join(" ");
}

export function assetDetailHeadlineHasContent(parts: AssetDetailHeadlineParts): boolean {
  return Boolean(parts.year?.trim() || parts.setName?.trim() || parts.cardName?.trim());
}

/** Document title / woven string — Year · Set · Card, then optional meta / Pop. */
export function computeAssetDetailWovenTitle(
  parts: AssetDetailHeadlineParts,
  metaStrip: string | null,
  populationBadge: string | null,
): string {
  const chunks: string[] = [];
  const base = formatAssetDetailHeadlineText(parts);
  if (base) chunks.push(base);
  const m = (metaStrip ?? "").trim();
  if (m) {
    const hay = base.toLowerCase();
    if (!hay.includes(m.toLowerCase())) chunks.push(m);
  }
  const pop = (populationBadge ?? "").trim();
  if (pop && !chunks.join(" ").toLowerCase().includes("pop ·")) chunks.push(pop);
  return chunks.join(" · ");
}

export type RwaHeadlineMetadata = {
  name?: string;
  description?: string;
  attributes?: { trait_type?: string; value?: unknown }[];
  properties?: unknown;
  graded?: unknown;
};

/** Card detail hero parts from graded NFT metadata. */
export function buildRwaAssetDetailHeadlineParts(
  meta: RwaHeadlineMetadata | null | undefined,
  fallbackCardName: string,
): AssetDetailHeadlineParts {
  const fallback = fallbackCardName.trim();
  if (!meta) {
    return { year: null, setName: null, cardName: fallback || null };
  }

  const props = meta.properties as Record<string, unknown> | undefined;
  const graded =
    (props?.graded ?? meta.graded) as Record<string, unknown> | undefined;
  const psa = graded?.psa as Record<string, unknown> | undefined;
  const card = graded?.card as Record<string, unknown> | undefined;

  const setRaw = pickString(card?.set, psa?.setHint) ?? "";
  const yearRaw = pickString(psa?.year, card?.year);
  const explicitYear = normalizeYear(yearRaw);

  let yearOut: string | null = explicitYear != null ? String(explicitYear) : null;
  let setOut: string | null = setRaw || null;
  if (setOut) {
    const yFromSet = leadingYearFromSetLine(setOut);
    if (yFromSet != null) {
      yearOut = yearOut ?? String(yFromSet);
      const stripped = setOut.replace(/^\s*\d{4}\b\s*/, "").trim();
      setOut = stripped || setOut;
    }
  }

  const numRaw = pickString(card?.number, psa?.cardNumberHint);
  const cardNameRaw =
    displayAssetNameFromMetadata(meta, fallback).trim() || fallback || null;

  let cardName = cardNameRaw;
  const num = formatHeadlineCardNumber(numRaw);
  if (num && cardName) cardName = mergeHeadlineCardNumberIntoTitle(cardName, num);

  if (!setOut && meta.attributes?.length) {
    for (const a of meta.attributes) {
      const tt = (a.trait_type ?? "").trim().toLowerCase();
      if (tt === "set") {
        const v = String(a.value ?? "").trim();
        if (v) setOut = v;
        break;
      }
    }
  }

  return {
    year: yearOut,
    setName: setOut,
    cardName,
  };
}
