import {
  formatHeadlineCardNumber,
  leadingYearFromSetLine,
  toCardDisplayCase,
  toCardDisplayUppercase,
} from "@/lib/marketplace/collectionFullDetailsTitle";
import {
  cardDisplayPartsFromAssetDetail,
  formatCardDisplayLanguageShort,
  formatCardDisplayLine1,
  formatCardDisplayLine2,
  formatCardDisplayName as formatCardDisplayNameCore,
  formatCardDisplayHoverTitle as formatCardDisplayHoverTitleCore,
  formatCardDisplaySetLabel,
  joinCardDisplaySegments,
  resolveCardDisplaySetName,
  resolveCardDisplayGrade,
} from "@/lib/marketplace/cardDisplayName";
import { displayAssetNameFromMetadata } from "@/lib/marketplace/rwaDisplayTitle";
import { resolveRwaMetadataVariant } from "@/lib/marketplace/resolveCardVariantLabel";
import { bucketGradeScoreFromPsaGradeInput, psaGradePolicyInputFromGraded } from "@/lib/market/psaGradePolicy";

/**
 * Structured fields for card display names.
 * Formatting rules: docs/guides/card-display-name.md
 */
export type AssetDetailHeadlineParts = {
  year: string | null;
  setName: string | null;
  cardNumber: string | null;
  cardName: string | null;
  variety: string | null;
  language?: string | null;
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
  const m = /(\d{4})/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1880 && y <= 2100 ? y : null;
}

function applyHeadlineCasing(value: string, uppercase: boolean): string {
  const t = value.trim();
  if (!t) return "";
  return uppercase ? toCardDisplayUppercase(t) : toCardDisplayCase(t);
}

function extractYearFromText(lineRaw: string | null | undefined): number | null {
  const line = lineRaw?.trim();
  if (!line) return null;
  const m = /(\d{4})/.exec(line);
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1880 && y <= 2100 ? y : null;
}

function toDisplayParts(
  parts: AssetDetailHeadlineParts,
  grade?: string | null,
) {
  return cardDisplayPartsFromAssetDetail(parts, grade);
}

/**
 * Build structured headline parts from collection / slab fields.
 * Default casing is title case (not ALL CAPS).
 */
export function buildAssetDetailHeadlineParts(input: {
  setLine?: string | null;
  year?: number | string | null;
  cardName?: string | null;
  cardNumber?: string | null;
  variety?: string | null;
  language?: string | null;
  /** Cardhedger / catalog expansion — display only; never written back to Brand. */
  catalogSetName?: string | null;
  /** @deprecated Prefer title case — only for rare ALL CAPS call sites. */
  uppercase?: boolean;
}): AssetDetailHeadlineParts {
  const uppercase = input.uppercase ?? false;
  const setRaw = (input.setLine ?? "").trim();
  const explicitYear = normalizeYear(input.year);

  let yearOut: string | null = null;
  let setOut: string | null = null;

  if (setRaw) {
    const yFromSet =
      leadingYearFromSetLine(setRaw) ?? extractYearFromText(setRaw);
    const y = yFromSet ?? explicitYear;
    if (y != null) yearOut = String(y);
    const withoutYear =
      y != null
        ? setRaw.replace(new RegExp(`\\b${String(y)}\\b`), "").trim()
        : setRaw;
    setOut = resolveCardDisplaySetName(
      withoutYear || setRaw,
      input.catalogSetName,
    );
  } else if (explicitYear != null) {
    yearOut = String(explicitYear);
  }

  const card = (input.cardName ?? "").trim();
  const num = formatHeadlineCardNumber(input.cardNumber);
  const variety = (input.variety ?? "").trim();
  const languageRaw = (input.language ?? "").trim();
  const languageShort =
    formatCardDisplayLanguageShort(languageRaw) ??
    (languageRaw ? applyHeadlineCasing(languageRaw, uppercase) : null);

  return {
    year: yearOut ? applyHeadlineCasing(yearOut, uppercase) : null,
    setName: setOut
      ? formatCardDisplaySetLabel(applyHeadlineCasing(setOut, uppercase))
      : null,
    cardNumber: num || null,
    cardName: card ? applyHeadlineCasing(card, uppercase) : null,
    variety: variety ? applyHeadlineCasing(variety, uppercase) : null,
    language: languageShort,
  };
}

/** Title line: `{Card name} · {Number} · {Grade}` — grade defaults to `Raw`. */
export function formatCardDisplayName(
  parts: AssetDetailHeadlineParts,
  opts?: { grade?: string | null },
): string {
  const display = toDisplayParts(parts, opts?.grade);
  const line1 = formatCardDisplayLine1(display);
  if (line1) return line1;
  return parts.variety?.trim() || resolveCardDisplayGrade(opts?.grade);
}

/** Meta line: `{Year} · {Set} {Language} · {Variant}`. */
export function formatCardDisplayMeta(
  parts: AssetDetailHeadlineParts,
  opts?: {
    /** @deprecated Grade belongs on the title line — ignored. */
    grade?: string | null;
    omitSet?: boolean;
    /** @deprecated Number belongs on the title line — ignored. */
    omitNumber?: boolean;
  },
): string {
  return formatCardDisplayLine2(toDisplayParts(parts, opts?.grade), {
    omitSet: opts?.omitSet,
  });
}

/** Hover / search / document title — Line 1 + Line 2 (self-contained). */
export function formatCardDisplayHoverTitle(
  parts: AssetDetailHeadlineParts,
  opts?: { grade?: string | null },
): string {
  return formatCardDisplayHoverTitleCore(toDisplayParts(parts, opts?.grade));
}

/**
 * User-facing title = Card name · Number · Grade.
 */
export function formatAssetDetailHeadlineText(
  parts: AssetDetailHeadlineParts,
  opts?: { grade?: string | null },
): string {
  return formatCardDisplayName(parts, opts);
}

export function assetDetailHeadlineHasContent(parts: AssetDetailHeadlineParts): boolean {
  return Boolean(
    parts.year?.trim() ||
      parts.setName?.trim() ||
      parts.cardNumber?.trim() ||
      parts.cardName?.trim() ||
      parts.variety?.trim(),
  );
}

/** Document / woven string — Title, then Meta / optional Pop. */
export function computeAssetDetailWovenTitle(
  parts: AssetDetailHeadlineParts,
  metaStrip: string | null,
  populationBadge: string | null,
  opts?: {
    grade?: string | null;
  },
): string {
  const chunks: string[] = [];
  const display = formatCardDisplayName(parts, opts);
  if (display) chunks.push(display);
  const m =
    (metaStrip ?? "").trim() ||
    formatCardDisplayMeta(parts, {
      grade: opts?.grade,
    });
  if (m) {
    const hay = display.toLowerCase();
    if (!hay.includes(m.toLowerCase())) chunks.push(m);
  }
  const pop = (populationBadge ?? "").trim();
  if (pop && !chunks.join(" ").toLowerCase().includes("pop ·")) chunks.push(pop);
  return joinCardDisplaySegments(chunks);
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
    return {
      year: null,
      setName: null,
      cardNumber: null,
      cardName: fallback ? toCardDisplayCase(fallback) : null,
      variety: null,
    };
  }

  const props = meta.properties as Record<string, unknown> | undefined;
  const graded =
    (props?.graded ?? meta.graded) as Record<string, unknown> | undefined;
  const psa = graded?.psa as Record<string, unknown> | undefined;
  const card = graded?.card as Record<string, unknown> | undefined;

  const catalogSet = pickString(card?.set);
  const yearRaw = pickString(psa?.Year, psa?.year, card?.year);
  const explicitYear = normalizeYear(yearRaw);

  let yearOut: string | null = explicitYear != null ? String(explicitYear) : null;
  let setOut: string | null =
    pickString(psa?.brand, card?.set, psa?.setHint) || null;
  if (setOut) {
    const yFromSet = leadingYearFromSetLine(setOut);
    if (yFromSet != null) {
      yearOut = yearOut ?? String(yFromSet);
      const stripped = setOut.replace(/^\s*\d{4}\b\s*/, "").trim();
      setOut = stripped || setOut;
    }
    setOut = resolveCardDisplaySetName(setOut, catalogSet);
  }

  const numRaw = pickString(card?.number, psa?.cardNumberHint);
  const cardNameRaw =
    pickString(psa?.subject, card?.name, psa?.cardNameHint) ??
    displayAssetNameFromMetadata(meta, fallback).trim() ??
    fallback ??
    null;
  const variety = resolveRwaMetadataVariant(graded);

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
    setName: setOut ? toCardDisplayCase(setOut) : null,
    cardNumber: formatHeadlineCardNumber(numRaw),
    cardName: cardNameRaw ? toCardDisplayCase(cardNameRaw) : null,
    variety: variety ? toCardDisplayCase(variety) : null,
  };
}

/** Grade for Line 1 — `{Company} {score}` (e.g. PSA 10). Not PSA qualifier copy like GEM MT 10. */
export function resolveRwaHeadlineGrade(
  meta: RwaHeadlineMetadata | null | undefined,
): string {
  if (!meta) return resolveCardDisplayGrade(null);
  const props = meta.properties as Record<string, unknown> | undefined;
  const graded =
    (props?.graded ?? meta.graded) as Record<string, unknown> | undefined;
  if (!graded || typeof graded !== "object") {
    return resolveCardDisplayGrade(null);
  }
  const psa = graded.psa as Record<string, unknown> | undefined;
  const company =
    pickString(
      psa?.gradingCompany,
      psa?.grader,
      graded.gradingCompany,
      graded.grader,
    ) ?? "PSA";
  const score = bucketGradeScoreFromPsaGradeInput(
    psaGradePolicyInputFromGraded(graded),
  );
  if (score === "auth") return toCardDisplayCase(`${company} AUTH`);
  if (score) return toCardDisplayCase(`${company} ${score}`);
  return resolveCardDisplayGrade(null);
}

export {
  cardDisplayPartsFromAssetDetail,
  formatCardDisplayLanguageShort,
  formatCardDisplayLine1,
  formatCardDisplayLine2,
  formatCardDisplayName as formatCardDisplayNameStructured,
  formatDetailBreadcrumbTrail,
  joinCardDisplaySegments,
  preferCatalogExpansionInBrandDisplay,
  resolveCardDisplaySetName,
  stripLeadingTcgSeriesFromSetDisplay,
  resolveCardDisplayGrade,
  stripCategoryPrefixFromSet,
  isDisplayVariantDuplicateOfSet,
  displayVariantIfNotSetDuplicate,
  shouldHideDuplicateVariant,
} from "@/lib/marketplace/cardDisplayName";
export type {
  CardDisplayNameMode,
  CardDisplayNameParts,
  FormatCardDisplayNameOptions,
} from "@/lib/marketplace/cardDisplayName";
