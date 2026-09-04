import type { MarketplaceCollectionSummary } from "@/lib/core";
import {
  buildAssetDetailHeadlineParts,
  cardDisplayPartsFromAssetDetail,
  formatCardDisplayLine1,
  formatCardDisplayLine2,
  formatCardDisplayHoverTitle,
  formatCardDisplayLanguageShort,
  resolveCardDisplayGrade,
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

export function gradeLabelFromComp(comp: CollectionComponents): string {
  const company = (comp.gradingCompanyDisplay ?? comp.gradingCompany)?.trim();
  const score = comp.gradeScore?.trim();
  if (company && score) return toCardDisplayCase(`${company} ${score}`);
  const label = comp.psaGradeLabel?.trim();
  if (label) return toCardDisplayCase(label);
  if (score) {
    const fallbackCompany = comp.gradingCompany?.trim() || "PSA";
    return toCardDisplayCase(`${fallbackCompany} ${score}`);
  }
  return resolveCardDisplayGrade(null);
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
  const languageRaw = comp.language?.trim() || null;
  const language =
    formatCardDisplayLanguageShort(languageRaw) ?? languageRaw ?? null;

  return buildAssetDetailHeadlineParts({
    setLine: setLine || null,
    year,
    cardName: cardName.trim() || null,
    cardNumber,
    variety,
    language,
  });
}

/** Markets tile Line 1 — `{Name} · {Number} · {Grade}`. */
export function formatMarketsCollectionTileTitle(
  parts: AssetDetailHeadlineParts,
  grade?: string | null,
): string {
  return formatCardDisplayLine1(cardDisplayPartsFromAssetDetail(parts, grade));
}

function collectionDisplayLabelFallback(
  collection: MarketplaceCollectionSummary,
): string {
  const dl =
    typeof collection.displayLabel === "string" ? collection.displayLabel.trim() : "";
  return dl ? toCardDisplayCase(dl) : "";
}

/** Markets / home / search / watchlist — Line 1 only. */
export function buildMarketsCollectionTitle(params: {
  collection: MarketplaceCollectionSummary;
  comp: CollectionComponents;
}): string {
  const parts = buildMarketsCollectionHeadlineParts(params);
  const grade = gradeLabelFromComp(params.comp);
  const out = formatMarketsCollectionTileTitle(parts, grade);
  if (out) return out;
  return collectionDisplayLabelFallback(params.collection);
}

/**
 * Landing Indices 1Y strip — `{Name} {Number}` only.
 * No middots and no grade (PSA 10) so the marquee labels stay short.
 */
export function buildHomeTickerCollectionTitle(params: {
  collection: MarketplaceCollectionSummary;
  comp: CollectionComponents;
}): string {
  const parts = buildMarketsCollectionHeadlineParts(params);
  const name = parts.cardName?.trim() || "";
  const number = parts.cardNumber?.trim() || "";
  const out = [name, number].filter(Boolean).join(" ");
  if (out) return out;
  return collectionDisplayLabelFallback(params.collection);
}

/** GNB search / self-contained surfaces — full Line 2 under Line 1 title. */
export function buildMarketsCollectionSearchMeta(params: {
  collection: MarketplaceCollectionSummary;
  comp: CollectionComponents;
}): string {
  const parts = buildMarketsCollectionHeadlineParts(params);
  return formatCardDisplayLine2(cardDisplayPartsFromAssetDetail(parts));
}

/** Meta under tile titles — `{Year} · {Set} {Language} · {Variant}`. */
export function buildMarketsCollectionMeta(params: {
  collection: MarketplaceCollectionSummary;
  comp: CollectionComponents;
}): string {
  const parts = buildMarketsCollectionHeadlineParts(params);
  return formatCardDisplayLine2(cardDisplayPartsFromAssetDetail(parts));
}

/** Single-line hover / search — self-contained Line 1 + Line 2. */
export function buildMarketsCollectionHoverTitle(params: {
  collection: MarketplaceCollectionSummary;
  comp: CollectionComponents;
}): string {
  const parts = buildMarketsCollectionHeadlineParts(params);
  const grade = gradeLabelFromComp(params.comp);
  const hover = formatCardDisplayHoverTitle(parts, { grade });
  if (hover) return hover;
  return buildMarketsCollectionTitle(params);
}
