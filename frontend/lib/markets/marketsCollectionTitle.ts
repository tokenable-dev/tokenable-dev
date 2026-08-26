import type { MarketplaceCollectionSummary } from "@/lib/core";
import {
  buildAssetDetailHeadlineParts,
  formatCardDisplayMeta,
  type AssetDetailHeadlineParts,
} from "@/lib/marketplace/assetDetailHeadline";
import { bucketCardSetForDisplay } from "@/lib/marketplace/bucketKey";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import {
  formatHeadlineCardNumber,
  toCardDisplayCase,
  yearFromComponents,
} from "@/lib/marketplace/collectionFullDetailsTitle";
import { resolveCollectionComponentVariant } from "@/lib/marketplace/resolveCardVariantLabel";
import {
  resolveCollectionSlabCardTitle,
  resolveCollectionSlabSetLine,
} from "@/lib/marketplace/slabDisplayTitle";

export function gradeLabelFromComp(comp: CollectionComponents): string | null {
  const company = (comp.gradingCompanyDisplay ?? comp.gradingCompany)?.trim();
  const score = comp.gradeScore?.trim();
  if (company && score) return toCardDisplayCase(`${company} ${score}`);
  const label = comp.psaGradeLabel?.trim();
  if (label) return toCardDisplayCase(label);
  if (score) {
    const fallbackCompany = comp.gradingCompany?.trim() || "PSA";
    return toCardDisplayCase(`${fallbackCompany} ${score}`);
  }
  return null;
}

export function buildMarketsCollectionHeadlineParts(params: {
  collection: MarketplaceCollectionSummary;
  comp: CollectionComponents;
}): AssetDetailHeadlineParts {
  const { collection, comp } = params;

  const dl =
    typeof collection.displayLabel === "string" ? collection.displayLabel.trim() : "";

  const setLine =
    (resolveCollectionSlabSetLine(comp) ?? bucketCardSetForDisplay(comp).trim()) || dl;
  const cardName = resolveCollectionSlabCardTitle(comp, {
    displayLabel: collection.displayLabel,
    collectionKey: collection.collectionKey,
  });
  const cardNumber = formatHeadlineCardNumber(comp.cardNumber);
  const variety = resolveCollectionComponentVariant(comp);
  let year: number | string | null = yearFromComponents(comp);
  if (year == null && dl) {
    const m = /(\d{4})/.exec(dl);
    if (m) {
      const yNum = Number(m[1]);
      if (Number.isFinite(yNum) && yNum >= 1880 && yNum <= 2100) {
        year = yNum;
      }
    }
  }

  return buildAssetDetailHeadlineParts({
    setLine: setLine || null,
    year,
    cardName: cardName.trim() || null,
    cardNumber,
    variety,
  });
}

/**
 * Tile / search title line — `{Name} {Number}[ · {Grade}]`.
 * Name and number are space-separated (no middle dot); grade keeps ` · `.
 * Prefer `buildMarketsCollectionTitle` + `buildMarketsCollectionMeta` for two-line UI.
 */
export function formatMarketsCollectionTileTitle(
  parts: AssetDetailHeadlineParts,
  grade?: string | null,
): string {
  const name = parts.cardName?.trim() || "";
  const num = parts.cardNumber?.trim() || "";
  const nameNum = [name, num].filter(Boolean).join(" ");
  const chunks: string[] = [];
  if (nameNum) chunks.push(nameNum);
  const g = grade?.trim() || "";
  if (g) chunks.push(g);
  if (chunks.length > 0) return chunks.join(" · ");
  return parts.variety?.trim() || "";
}

/** Markets / home / search primary title — `{Name} {Number}[ · {Grade}]`. */
export function buildMarketsCollectionTitle(params: {
  collection: MarketplaceCollectionSummary;
  comp: CollectionComponents;
  /** Markets grid: grade is shown as a badge — omit from title. */
  omitGrade?: boolean;
}): string {
  const { collection } = params;
  const parts = buildMarketsCollectionHeadlineParts(params);
  const grade = params.omitGrade ? null : gradeLabelFromComp(params.comp);
  const out = formatMarketsCollectionTileTitle(parts, grade);
  if (out) return out;
  const dl =
    typeof collection.displayLabel === "string" ? collection.displayLabel.trim() : "";
  return dl ? toCardDisplayCase(dl) : "";
}

/** Meta under tile titles — `{Year} · {Set} · {Variant}`. */
export function buildMarketsCollectionMeta(params: {
  collection: MarketplaceCollectionSummary;
  comp: CollectionComponents;
}): string {
  const parts = buildMarketsCollectionHeadlineParts(params);
  return formatCardDisplayMeta(parts);
}

/** Single-line hover / search / ticker — Title · Meta. */
export function buildMarketsCollectionHoverTitle(params: {
  collection: MarketplaceCollectionSummary;
  comp: CollectionComponents;
}): string {
  const parts = buildMarketsCollectionHeadlineParts(params);
  const grade = gradeLabelFromComp(params.comp);
  const title = formatMarketsCollectionTileTitle(parts, grade);
  const meta = formatCardDisplayMeta(parts);
  const hover = [title, meta].filter(Boolean).join(" · ");
  if (hover) return hover;
  return buildMarketsCollectionTitle(params);
}
