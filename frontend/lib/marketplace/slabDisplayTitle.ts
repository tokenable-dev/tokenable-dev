import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import {
  formatCollectionHeroCardTitle,
  formatHeadlineCardNumber,
  toCardDisplayCase,
  yearFromComponents,
} from "@/lib/marketplace/collectionFullDetailsTitle";
import { listingDisplayTitleFromComp } from "@/lib/marketplace/collectionListingUtils";
import { bucketCardNameForDisplay, bucketCardSetForDisplay } from "@/lib/marketplace/bucketKey";
import { resolveCollectionComponentVariant } from "@/lib/marketplace/resolveCardVariantLabel";

/** Strip trailing `PSA 10` / `PSA GEM MT 10` suffixes from legacy mint `metadata.name` values. */
export function stripListingTitlePsaGradeSuffix(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  let s = trimmed;
  s = s.replace(/\s+PSA\s+GEM\s*MT\s*\d+(?:\.\d+)?\s*$/i, "").trim();
  s = s.replace(/\s+PSA\s+MINT\s*\d+(?:\.\d+)?\s*$/i, "").trim();
  s = s.replace(/\s+PSA\s*NM\s*[- ]?\s*MT\s*\d+\s*$/i, "").trim();
  s = s.replace(/\s+PSA\s*\d+(?:\.\d+)?\s*$/i, "").trim();

  return s.length > 0 ? s : trimmed;
}

/**
 * Card name for collection hero / markets grid — prefer PSA slab Subject (what is printed on the label).
 */
export function resolveCollectionSlabCardTitle(
  comp: CollectionComponents,
  fallback?: { displayLabel?: string | null; collectionKey?: string },
): string {
  const psaSubject =
    typeof comp.psaSubject === "string" ? comp.psaSubject.trim() : "";
  if (psaSubject.length > 0) return toCardDisplayCase(psaSubject);

  const listingTitle = stripListingTitlePsaGradeSuffix(listingDisplayTitleFromComp(comp));
  if (listingTitle.length > 0) return toCardDisplayCase(listingTitle);

  const bucketName = bucketCardNameForDisplay(comp).trim();
  if (bucketName.length > 0) {
    return toCardDisplayCase(formatCollectionHeroCardTitle(comp));
  }

  const dl =
    typeof fallback?.displayLabel === "string" ? fallback.displayLabel.trim() : "";
  if (dl.length > 0) return toCardDisplayCase(dl);

  const key = fallback?.collectionKey ?? "";
  if (key.length > 0) {
    return toCardDisplayCase(key.slice(0, 18) + (key.length > 18 ? "…" : ""));
  }

  return toCardDisplayCase("Collection");
}

/** Set line from PSA Brand + Year when the slab mirror is available. */
export function resolveCollectionSlabSetLine(comp: CollectionComponents): string | null {
  const brand = typeof comp.psaBrand === "string" ? comp.psaBrand.trim() : "";
  if (!brand) return null;

  const yearRaw = comp.psaYear;
  let year: string | null = null;
  if (typeof yearRaw === "number" && Number.isFinite(yearRaw)) {
    const y = Math.trunc(yearRaw);
    if (y >= 1880 && y <= 2100) year = String(y);
  } else if (typeof yearRaw === "string") {
    const m = /(\d{4})/.exec(yearRaw.trim());
    if (m) {
      const y = Number(m[1]);
      if (y >= 1880 && y <= 2100) year = String(y);
    }
  }

  const line = year && !/^\s*\d{4}\b/.test(brand) ? `${year} ${brand}` : brand;
  return toCardDisplayCase(line);
}

/** Max characters on the left column of a PSA label (real slabs ~26–28 at this scale). */
const PSA_SLAB_LABEL_LEFT_MAX = 28;

const PSA_SLAB_LABEL_ABBREV: ReadonlyArray<[RegExp, string]> = [
  [/\bFORMULA\s+ONE\b/gi, "F1"],
  [/\bFORMULA\s+1\b/gi, "F1"],
  [/\bF\s+1\b/gi, "F1"],
  [/\bPOKEMON\b/gi, "P.M."],
  [/\bUNIVERSITY\b/gi, "UNIV."],
  [/\bSPECIAL ART RARE\b/gi, "SP ART RARE"],
  [/\bREFRACTOR\b/gi, "REF."],
  [/\bHOLOGRAPHIC\b/gi, "HOLO"],
  [/\bALTERNATE ART\b/gi, "ALT ART"],
  [/\bALTERNATE\b/gi, "ALT."],
  [/\bBOOSTER PACK\b/gi, "BOOSTER"],
];

/** PSA-style abbreviations so long set / variety lines fit without ellipsis. */
export function abbreviateForPsaSlabLabel(text: string): string {
  let s = text.trim().replace(/\s+/g, " ");
  for (const [pattern, replacement] of PSA_SLAB_LABEL_ABBREV) {
    s = s.replace(pattern, replacement);
  }
  return s.replace(/\s+/g, " ").trim();
}

/** Typography on a physical PSA label — always uppercase. */
export function normalizePsaSlabLabelTypography(text: string): string {
  return abbreviateForPsaSlabLabel(text).replace(/\s+/g, " ").trim().toUpperCase();
}

/** Fit one left-column label line — word trim only, never `…`. */
export function fitPsaSlabLabelLine(text: string, maxChars = PSA_SLAB_LABEL_LEFT_MAX): string {
  let s = normalizePsaSlabLabelTypography(text);
  if (s.length <= maxChars) return s;

  const dropWords = ["THE", "AND", "OF", "A"];
  const words = s.split(" ");
  while (words.length > 2 && words.join(" ").length > maxChars) {
    const idx = words.findIndex((w) => dropWords.includes(w));
    if (idx === -1) break;
    words.splice(idx, 1);
    s = words.join(" ");
  }
  if (s.length <= maxChars) return s;

  if (s.length > maxChars) {
    const cut = s.slice(0, maxChars);
    const lastSpace = cut.lastIndexOf(" ");
    s = lastSpace > Math.floor(maxChars * 0.55) ? cut.slice(0, lastSpace) : cut.trimEnd();
  }
  return s;
}

/** PSA physical label — set line when Brand mirror is missing. */
export function resolveCollectionSlabSetLineWithFallback(
  comp: CollectionComponents,
  displayLabel?: string | null,
): string {
  const fromPsa = resolveCollectionSlabSetLine(comp);
  if (fromPsa) return fromPsa;

  const set = bucketCardSetForDisplay(comp).trim();
  const year = yearFromComponents(comp);
  if (year != null && set) {
    const y = String(year);
    if (!/^\s*\d{4}\b/.test(set)) return toCardDisplayCase(`${y} ${set}`);
    return toCardDisplayCase(set);
  }
  if (set) return toCardDisplayCase(set);

  const dl = typeof displayLabel === "string" ? displayLabel.trim() : "";
  return dl ? toCardDisplayCase(dl) : "";
}

/** PSA's published grade names — used when the cert mirror has a score but no label text. */
const PSA_GRADE_NAMES: Record<string, string> = {
  "10": "GEM MT",
  "9": "MINT",
  "8": "NM-MT",
  "7": "NM",
  "6": "EX-MT",
  "5": "EX",
  "4": "VG-EX",
  "3": "VG",
  "2": "GOOD",
  "1": "PR",
};

/**
 * Grade as printed on the right side of a PSA label: name line (`GEM MT`) + score line (`10`).
 * Accepts `psaGradeLabel` in either `GEM MT 10` or `GEM MT` form.
 */
export function resolvePsaSlabLabelGrade(comp: CollectionComponents): {
  name: string;
  score: string;
} {
  const rawLabel = normalizePsaSlabLabelTypography(
    typeof comp.psaGradeLabel === "string" ? comp.psaGradeLabel : "",
  );
  const rawScore =
    typeof comp.gradeScore === "string" ? comp.gradeScore.trim() : "";

  const trailing = /^(.*?)\s*(\d{1,2}(?:\.\d)?)$/.exec(rawLabel);
  const name = (trailing ? trailing[1] : rawLabel).trim();
  const score = (trailing ? trailing[2] : rawScore).trim();
  const fallbackName =
    PSA_GRADE_NAMES[String(Math.floor(Number(score)))] ?? "";

  return { name: name || fallbackName, score };
}

/** Card # as printed on PSA labels (`#1`, `#278` — no zero-padding). */
export function formatPsaSlabLabelCardNumber(
  raw: string | undefined | null,
): string | null {
  const n = String(raw ?? "")
    .trim()
    .replace(/^#/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!n) return null;
  if (/^\d+$/.test(n)) {
    const v = parseInt(n, 10);
    return Number.isFinite(v) ? `#${v}` : null;
  }
  const token = formatHeadlineCardNumber(n);
  return token ? `#${token.toUpperCase()}` : `#${n.toUpperCase()}`;
}

export type CollectionPsaSlabLabelFields = {
  setLine: string;
  cardName: string;
  variety: string | null;
  cardNumber: string | null;
  gradeName: string;
  gradeScore: string;
};

function resolvePsaSlabLabelVariety(comp: CollectionComponents): string | null {
  const psaVariety =
    typeof comp.psaVariety === "string" ? comp.psaVariety.trim() : "";
  if (psaVariety) return normalizePsaSlabLabelTypography(psaVariety);
  const variant = resolveCollectionComponentVariant(comp);
  return variant ? normalizePsaSlabLabelTypography(variant) : null;
}

/** Row 1 left — year + PSA Brand (preferred) or catalog set, PSA typography. */
function resolvePsaSlabLabelSetRaw(
  comp: CollectionComponents,
  displayLabel?: string | null,
): string {
  const psaBrand =
    typeof comp.psaBrand === "string" ? comp.psaBrand.trim() : "";
  const catalogSet = bucketCardSetForDisplay(comp).trim();
  const brand = psaBrand || catalogSet;

  if (!brand) {
    const dl = typeof displayLabel === "string" ? displayLabel.trim() : "";
    return dl ? normalizePsaSlabLabelTypography(dl) : "";
  }

  const yearRaw = comp.psaYear ?? yearFromComponents(comp);
  let year: string | null = null;
  if (typeof yearRaw === "number" && Number.isFinite(yearRaw)) {
    const y = Math.trunc(yearRaw);
    if (y >= 1880 && y <= 2100) year = String(y);
  } else if (typeof yearRaw === "string") {
    const m = /(\d{4})/.exec(yearRaw.trim());
    if (m) {
      const y = Number(m[1]);
      if (y >= 1880 && y <= 2100) year = String(y);
    }
  }

  const line =
    year && !/^\s*\d{4}\b/.test(brand) ? `${year} ${brand}` : brand;
  return normalizePsaSlabLabelTypography(line);
}

/** Row 2 left — PSA Subject (card name on the slab). */
function resolvePsaSlabLabelSubjectRaw(
  comp: CollectionComponents,
  fallback?: { displayLabel?: string | null; collectionKey?: string },
): string {
  const psaSubject =
    typeof comp.psaSubject === "string" ? comp.psaSubject.trim() : "";
  if (psaSubject) return normalizePsaSlabLabelTypography(psaSubject);

  const listingTitle = stripListingTitlePsaGradeSuffix(
    listingDisplayTitleFromComp(comp),
  );
  if (listingTitle) return normalizePsaSlabLabelTypography(listingTitle);

  const bucketName = bucketCardNameForDisplay(comp).trim();
  if (bucketName) {
    return normalizePsaSlabLabelTypography(
      formatCollectionHeroCardTitle(comp),
    );
  }

  const dl =
    typeof fallback?.displayLabel === "string" ? fallback.displayLabel.trim() : "";
  if (dl) return normalizePsaSlabLabelTypography(dl);

  return "COLLECTION";
}

export function buildCollectionPsaSlabLabelFields(params: {
  comp: CollectionComponents;
  displayLabel?: string | null;
  collectionKey?: string;
}): CollectionPsaSlabLabelFields {
  const { comp, displayLabel, collectionKey } = params;
  const grade = resolvePsaSlabLabelGrade(comp);
  const cardNumber = formatPsaSlabLabelCardNumber(comp.cardNumber);
  const varietyRaw = resolvePsaSlabLabelVariety(comp);

  return {
    setLine: fitPsaSlabLabelLine(resolvePsaSlabLabelSetRaw(comp, displayLabel)),
    cardName: fitPsaSlabLabelLine(
      resolvePsaSlabLabelSubjectRaw(comp, { displayLabel, collectionKey }),
    ),
    variety: varietyRaw ? fitPsaSlabLabelLine(varietyRaw) : null,
    cardNumber,
    gradeName: grade.name,
    gradeScore: grade.score,
  };
}
