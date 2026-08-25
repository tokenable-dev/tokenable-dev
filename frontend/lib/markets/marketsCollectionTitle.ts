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

function gradeLabelFromComp(comp: CollectionComponents): string | null {
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
 * Markets grid / search / ticker catalog line — Card.html card__title order:
 * `{Year} {Set} #{Number} {CardName} [{Variant}]`
 */
export function formatMarketsCollectionTileTitle(
  parts: AssetDetailHeadlineParts,
): string {
  const card = parts.cardName?.trim() ?? "";
  const variety = parts.variety?.trim() ?? "";
  const nameChunks: string[] = [];
  if (card) nameChunks.push(card);
  if (
    variety &&
    !card.toLowerCase().includes(variety.toLowerCase()) &&
    !nameChunks.some((c) => c.toLowerCase().includes(variety.toLowerCase()))
  ) {
    nameChunks.push(variety);
  }

  return [parts.year, parts.setName, parts.cardNumber, ...nameChunks]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter((s): s is string => Boolean(s))
    .join(" ");
}

/** Markets / home / search tile title — full catalog line (not hero Display name). */
export function buildMarketsCollectionTitle(params: {
  collection: MarketplaceCollectionSummary;
  comp: CollectionComponents;
}): string {
  const { collection } = params;
  const parts = buildMarketsCollectionHeadlineParts(params);
  const out = formatMarketsCollectionTileTitle(parts);
  if (out) return out;
  const dl =
    typeof collection.displayLabel === "string" ? collection.displayLabel.trim() : "";
  return dl ? toCardDisplayCase(dl) : "";
}

/** Optional meta under tile titles — Year · Set · # · Grade. */
export function buildMarketsCollectionMeta(params: {
  collection: MarketplaceCollectionSummary;
  comp: CollectionComponents;
}): string {
  const parts = buildMarketsCollectionHeadlineParts(params);
  return formatCardDisplayMeta(parts, { grade: gradeLabelFromComp(params.comp) });
}
