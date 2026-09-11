import type {
  MarketplaceCollectionSummary,
  MarketplaceSearchCardHit,
} from "@/lib/core";
import {
  buildAssetDetailHeadlineParts,
  cardDisplayPartsFromAssetDetail,
  formatCardDisplayLine1,
  formatCardDisplayLine2,
  type AssetDetailHeadlineParts,
} from "@/lib/marketplace/assetDetailHeadline";
import { parseCollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import { toCardDisplayCase } from "@/lib/marketplace/collectionFullDetailsTitle";
import {
  buildMarketsCollectionHeadlineParts,
  buildMarketsCollectionSearchMeta,
  buildMarketsCollectionTitle,
  gradeLabelFromComp,
} from "@/lib/markets/marketsCollectionTitle";

function summaryFromSearchCard(
  card: MarketplaceSearchCardHit,
): MarketplaceCollectionSummary | null {
  const components = parseCollectionComponents(card.components ?? null);
  if (
    !components.cardName &&
    !components.cardNameDisplay &&
    !components.psaSubject &&
    !components.gradeScore
  ) {
    return null;
  }
  return {
    collectionKey: card.collectionKey?.trim() || `search:${card.tokenId}`,
    displayLabel: card.title,
    queryUsed: null,
    components,
    createdAt: "",
    activeListingCount: 0,
  };
}

/** Search card rows — Line 1 `{Name} · {Number} · {Grade}` + Line 2 provenance. */
export function formatSearchCardHitDisplay(card: MarketplaceSearchCardHit): {
  line1: string;
  line2: string;
  parts: AssetDetailHeadlineParts;
  grade: string | null;
} {
  const summary = summaryFromSearchCard(card);
  if (summary) {
    const parts = buildMarketsCollectionHeadlineParts({
      collection: summary,
      comp: summary.components,
    });
    const grade = gradeLabelFromComp(summary.components);
    const line1 = buildMarketsCollectionTitle({
      collection: summary,
      comp: summary.components,
    });
    const line2 = buildMarketsCollectionSearchMeta({
      collection: summary,
      comp: summary.components,
    });
    if (line1) {
      return { line1, line2, parts, grade };
    }
  }

  const parts = buildAssetDetailHeadlineParts({
    setLine: card.setLine,
    year: null,
    cardName: card.title,
    cardNumber: null,
    variety: null,
    language: null,
  });
  const grade = card.gradeLabel;
  const line1 =
    formatCardDisplayLine1(cardDisplayPartsFromAssetDetail(parts, grade)) ||
    toCardDisplayCase(card.title);
  const line2 = formatCardDisplayLine2(cardDisplayPartsFromAssetDetail(parts));
  return { line1, line2, parts, grade };
}
