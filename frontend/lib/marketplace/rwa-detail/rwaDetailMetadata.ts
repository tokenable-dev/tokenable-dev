import { formatSportCategoryDisplayLabel } from "@/lib/market";
import type { AssetDetailHeadlineParts } from "@/lib/marketplace/assetDetailHeadline";
import { formatAssetDetailHeadlineText } from "@/lib/marketplace/assetDetailHeadline";
import { resolveRwaMetadataVariant } from "@/lib/marketplace/resolveCardVariantLabel";

export type RwaDetailMetadata = {
  name?: string;
  description?: string;
  external_url?: string;
  image?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
  properties?: Record<string, unknown>;
};

function pickString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (v == null || v === "") continue;
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    if (typeof v === "string") {
      const t = v.trim();
      if (t) return t;
    }
  }
  return undefined;
}

export function extractGradedSlabBackCandidate(meta: RwaDetailMetadata | null): string | null {
  if (!meta?.properties?.graded || typeof meta.properties.graded !== "object") return null;
  const graded = meta.properties.graded as Record<string, unknown>;
  const psa =
    graded.psa && typeof graded.psa === "object"
      ? (graded.psa as Record<string, unknown>)
      : null;
  const fromPsa = typeof psa?.certImageBackUrl === "string" ? psa.certImageBackUrl.trim() : "";
  if (fromPsa) return fromPsa;
  const verification =
    graded.verification && typeof graded.verification === "object"
      ? (graded.verification as Record<string, unknown>)
      : null;
  const slabBack =
    typeof verification?.slabBack === "string" ? verification.slabBack.trim() : "";
  return slabBack || null;
}

/** `properties.graded` + attributes → desktop Details grid rows. */
export function buildRwaDetailStatRows(meta: RwaDetailMetadata | null): {
  label: string;
  value: string;
}[] {
  if (!meta) return [];
  const graded = meta.properties?.graded as Record<string, unknown> | undefined;
  const psa = graded?.psa as Record<string, unknown> | undefined;
  const card = graded?.card as Record<string, unknown> | undefined;
  const grade = graded?.grade as Record<string, unknown> | undefined;

  const rows: { label: string; value: string }[] = [];

  const player = pickString(card?.player, card?.name, psa?.cardNameHint);
  const set = pickString(card?.set, psa?.setHint);
  const num = pickString(card?.number, psa?.cardNumberHint);
  const variant = resolveRwaMetadataVariant(graded);
  const gradeLabel = pickString(
    psa?.gradeLabel,
    typeof grade?.label === "string" ? grade.label : undefined,
  );
  const cert = pickString(psa?.certNumber, grade?.certNumber);
  const year = pickString(psa?.year, card?.year);
  const category = pickString(psa?.category);

  if (player) rows.push({ label: "Player", value: player });
  if (num) {
    rows.push({
      label: "Card Number",
      value: String(num).startsWith("#") ? String(num) : `#${num}`,
    });
  }
  if (set) rows.push({ label: "Set", value: set });
  if (variant) rows.push({ label: "Variant", value: variant });
  if (gradeLabel) rows.push({ label: "Grade", value: gradeLabel });
  if (year) rows.push({ label: "Year", value: year });
  if (category) {
    rows.push({
      label: "Category",
      value: formatSportCategoryDisplayLabel(category),
    });
  }
  if (cert) rows.push({ label: "Cert #", value: cert });

  if (rows.length >= 2) return rows.slice(0, 8);

  const attrs = meta.attributes ?? [];
  for (const a of attrs) {
    if (rows.length >= 8) break;
    if (!a?.trait_type) continue;
    const skip = new Set(["Grading Company", "Grade", "Cert Number", "Certification"]);
    if (skip.has(a.trait_type)) continue;
    const v = String(a.value ?? "").trim();
    if (!v) continue;
    if (rows.some((r) => r.label === a.trait_type && r.value === v)) continue;
    rows.push({ label: a.trait_type, value: v });
  }

  return rows;
}

export type RwaDetailMobileTrustView = {
  gradeLine: string | null;
  population: number | null;
  populationHigher: number | null;
  certNumber: string | null;
  certVerifyUrl: string | null;
};

function joinSlabTextParts(...vals: (string | null | undefined)[]): string {
  return vals
    .map((v) => v?.trim())
    .filter((v): v is string => Boolean(v))
    .join(" ");
}

function slabGradeShort(trust: RwaDetailMobileTrustView): string {
  const grade = trust.gradeLine?.trim();
  if (!grade) return "";
  return grade.replace(/^PSA\s+/i, "").trim() || grade;
}

function formatRwaMobileSlabCertLabel(certNumber: string | null | undefined): string {
  const cert = certNumber?.trim() ?? "";
  return cert ? `CERT. ${cert}` : "";
}

function formatRwaMobileSlabTitleBlock(parts: AssetDetailHeadlineParts): string {
  const variety = parts.variety?.trim() ?? "";
  const withoutVariety =
    joinSlabTextParts(
      parts.year,
      parts.setName,
      parts.cardName,
      parts.cardNumber,
    ) || "";
  const title =
    variety && variety !== withoutVariety
      ? joinSlabTextParts(withoutVariety || null, variety)
      : withoutVariety;

  return title || "—";
}

/**
 * Mobile RWA — full slab copy as one line (e.g. screen readers).
 */
export function formatRwaMobileSlabLabelLine(
  parts: AssetDetailHeadlineParts,
  trust: RwaDetailMobileTrustView,
): string {
  const { titleBlock, gradeLine, certLabel } = formatRwaMobileSlabLabelTwoLines(
    parts,
    trust,
  );
  return (
    joinSlabTextParts(
      titleBlock === "—" ? null : titleBlock,
      gradeLine,
      certLabel,
    ) || "—"
  );
}

/**
 * Mobile RWA — slab copy below the card:
 * title = year · set · subject · # · variety (wraps naturally);
 * meta row = grade + CERT. number (styled separately in UI).
 */
export function formatRwaMobileSlabLabelTwoLines(
  parts: AssetDetailHeadlineParts,
  trust: RwaDetailMobileTrustView,
): { titleBlock: string; gradeLine: string; certLabel: string } {
  return {
    titleBlock: formatRwaMobileSlabTitleBlock(parts),
    gradeLine: slabGradeShort(trust),
    certLabel: formatRwaMobileSlabCertLabel(trust.certNumber),
  };
}

export function buildRwaDetailMobileTrustView(meta: RwaDetailMetadata | null): RwaDetailMobileTrustView {
  const empty: RwaDetailMobileTrustView = {
    gradeLine: null,
    population: null,
    populationHigher: null,
    certNumber: null,
    certVerifyUrl: null,
  };
  if (!meta) return empty;

  const graded = meta.properties?.graded as Record<string, unknown> | undefined;
  const psa = graded?.psa as Record<string, unknown> | undefined;
  const grade = graded?.grade as Record<string, unknown> | undefined;
  const verification =
    graded?.verification && typeof graded.verification === "object"
      ? (graded.verification as Record<string, unknown>)
      : undefined;

  const { gradeLine } = getRwaDetailHeaderBadgeLabels(meta);

  const popRaw = psa?.totalPopulation;
  const population =
    typeof popRaw === "number" && Number.isFinite(popRaw) && popRaw > 0 ? popRaw : null;

  const higherRaw = psa?.populationHigher;
  const populationHigher =
    typeof higherRaw === "number" && Number.isFinite(higherRaw) && higherRaw >= 0 ? higherRaw : null;

  const certNumber = pickString(psa?.certNumber, grade?.certNumber);
  const certVerifyUrl = pickString(psa?.certVerifyUrl, verification?.certUrl);

  return {
    gradeLine: gradeLine?.trim() ? gradeLine : null,
    population,
    populationHigher,
    certNumber: certNumber ?? null,
    certVerifyUrl: certVerifyUrl ?? null,
  };
}

export function formatRwaSetHeadline(meta: RwaDetailMetadata | null): string | null {
  if (!meta) return null;
  const graded = meta.properties?.graded as Record<string, unknown> | undefined;
  const psa = graded?.psa as Record<string, unknown> | undefined;
  const card = graded?.card as Record<string, unknown> | undefined;
  const numRaw = pickString(card?.number, psa?.cardNumberHint);
  const set = pickString(card?.set, psa?.setHint);
  const year = pickString(psa?.year, card?.year);
  let left = "";
  if (year && set) left = `${year} ${set}`;
  else left = pickString(year, set) ?? "";
  left = left.trim();

  let numFormatted: string | null = null;
  if (numRaw) {
    const s = String(numRaw).trim();
    numFormatted = s.startsWith("#") ? s : `#${s}`;
  }

  if (left && numFormatted) return `${left} | ${numFormatted}`;
  if (left) return left;
  if (numFormatted) return numFormatted;

  if (meta.attributes?.length) {
    let setAttr: string | undefined;
    let numAttr: string | undefined;
    for (const a of meta.attributes) {
      const tt = (a.trait_type ?? "").trim().toLowerCase();
      const v = String(a.value ?? "").trim();
      if (!v) continue;
      if (tt === "set") setAttr = v;
      const numish =
        tt === "card number" || tt === "card #" || tt === "card no" || tt === "#" || tt === "number";
      if (numish) numAttr = v.startsWith("#") ? v : `#${v}`;
    }
    if (setAttr && numAttr) return `${setAttr} | ${numAttr}`;
    return pickString(setAttr, numAttr) ?? null;
  }
  return null;
}

export function formatRwaDetailSetDescription(meta: RwaDetailMetadata | null): string | null {
  if (!meta) return null;
  const graded = meta.properties?.graded as Record<string, unknown> | undefined;
  const psa = graded?.psa as Record<string, unknown> | undefined;
  const card = graded?.card as Record<string, unknown> | undefined;
  const year = pickString(psa?.year, card?.year);
  const set = pickString(card?.set, psa?.setHint);
  if (year && set) return `${year} ${set}`;
  const one = pickString(set, year);
  if (one) return one;
  const desc = typeof meta.description === "string" ? meta.description.trim() : "";
  return desc.length > 0 ? desc : null;
}

export function formatRwaDetailCardIdLine(meta: RwaDetailMetadata | null): string | null {
  if (!meta) return null;
  const graded = meta.properties?.graded as Record<string, unknown> | undefined;
  const psa = graded?.psa as Record<string, unknown> | undefined;
  const card = graded?.card as Record<string, unknown> | undefined;
  const numRaw = pickString(card?.number, psa?.cardNumberHint);
  if (!numRaw) return null;
  const s = String(numRaw).trim();
  return s.startsWith("#") ? s : `#${s}`;
}

export function getRwaDetailHeaderBadgeLabels(meta: RwaDetailMetadata | null): {
  category: string | null;
  gradeLine: string | null;
} {
  if (!meta) return { category: null, gradeLine: null };
  const graded = meta.properties?.graded as Record<string, unknown> | undefined;
  const psa = graded?.psa as Record<string, unknown> | undefined;
  const grade = graded?.grade as Record<string, unknown> | undefined;

  let category =
    pickString(psa?.category) ??
    (typeof graded?.sport === "string" ? graded.sport.trim() : undefined);

  const company = pickString(typeof psa?.company === "string" ? psa.company.trim() : undefined);
  let gradeLabel = pickString(
    psa?.gradeLabel,
    typeof grade?.label === "string" ? String(grade.label).trim() : undefined,
  );

  let gradeLine: string | null = null;
  if (gradeLabel) {
    const g = gradeLabel.trim();
    if (/^psa\s/i.test(g)) gradeLine = g.toUpperCase();
    else if (company) gradeLine = `${company} ${g}`.trim();
    else gradeLine = g;
  }

  let catOut = category?.trim() ?? null;
  let gradeOut = gradeLine?.trim() ?? null;

  for (const a of meta.attributes ?? []) {
    const trait = (a.trait_type ?? "").trim();
    const tl = trait.toLowerCase();
    const v = String(a.value ?? "").trim();
    if (!v) continue;
    if (!catOut && /^(category|game|type)$/i.test(tl)) catOut = v;
    if (!gradeOut && (/^grade$/i.test(tl) || /^psa(\s|$)/i.test(trait))) gradeOut = v;
  }

  return {
    category: catOut?.length ? formatSportCategoryDisplayLabel(catOut) : null,
    gradeLine: gradeOut?.length ? gradeOut : null,
  };
}

/** PSA-graded slab metadata — reserved for future vault routing (PSA vs Tokenable). */
export function isPsaGradedRwaMetadata(meta: RwaDetailMetadata | null): boolean {
  if (!meta) return false;
  const graded = meta.properties?.graded as Record<string, unknown> | undefined;
  if (!graded || typeof graded !== "object") return false;
  const psa = graded.psa as Record<string, unknown> | undefined;
  const grade = graded.grade as Record<string, unknown> | undefined;
  const cert = pickString(psa?.certNumber, grade?.certNumber);
  if (cert) return true;
  const company = pickString(typeof psa?.company === "string" ? psa.company.trim() : undefined);
  if (company && /psa/i.test(company)) return true;
  const gradeLabel = pickString(
    psa?.gradeLabel,
    typeof grade?.label === "string" ? String(grade.label).trim() : undefined,
  );
  if (gradeLabel && /psa/i.test(gradeLabel)) return true;
  for (const a of meta.attributes ?? []) {
    const trait = (a.trait_type ?? "").trim();
    if (/^psa(\s|$)/i.test(trait)) return true;
    if (/^grade$/i.test(trait.toLowerCase()) && /psa/i.test(String(a.value ?? ""))) return true;
  }
  return false;
}
