import type { MarketplaceCollectionSummary } from "@/lib/core";
import {
  buildAssetDetailHeadlineParts,
  formatAssetDetailHeadlineText,
} from "@/lib/marketplace/assetDetailHeadline";
import { bucketCardSetForDisplay } from "@/lib/marketplace/bucketKey";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import {
  formatHeadlineCardNumber,
  toCardDisplayUppercase,
  yearFromComponents,
} from "@/lib/marketplace/collectionFullDetailsTitle";
import { resolveCollectionComponentVariant } from "@/lib/marketplace/resolveCardVariantLabel";
import {
  resolveCollectionSlabCardTitle,
  resolveCollectionSlabSetLine,
} from "@/lib/marketplace/slabDisplayTitle";

export function buildMarketsCollectionTitle(params: {
  collection: MarketplaceCollectionSummary;
  comp: CollectionComponents;
}): string {
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
  const year = yearFromComponents(comp);

  const parts = buildAssetDetailHeadlineParts({
    setLine: setLine || null,
    year,
    cardName: cardName.trim() || null,
    cardNumber,
    variety,
    uppercase: true,
  });

  const out = formatAssetDetailHeadlineText(parts);
  return out || (dl ? toCardDisplayUppercase(dl) : "");
}
