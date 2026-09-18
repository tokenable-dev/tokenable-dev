import type {
  CollectionListMarketSnapshot,
  MarketplaceCollectionSummary,
} from "@/lib/core";
import { referenceLagAnchorFromPoints } from "@/lib/market/externalMarketPrice";
import {
  parseGradeScoreNumber,
  percentChangeReferenceBestWindow,
  resolveExternalMarketUsd,
} from "@/lib/market";
import { parseCollectionComponents } from "@/lib/marketplace/collectionDetailComponents";

const MARKET_CHANGE_LAG_90D_SEC = 90 * 86_400;

/**
 * Markets grid / landing carousel spot USD — same resolution order as collection detail
 * ({@link resolveExternalMarketUsd} + `market-series` preview).
 */
export function resolveMarketsListingMarketUsd(
  collection: MarketplaceCollectionSummary,
  snapshot: CollectionListMarketSnapshot | undefined,
): number | null {
  const comp = parseCollectionComponents(collection.components);
  const resolved = resolveExternalMarketUsd({
    marketPreview: snapshot?.cardhedgerPreview ?? null,
    gradePrices: snapshot?.gradePrices ?? null,
    gradeScore: parseGradeScoreNumber(comp.gradeScore),
    components: comp,
    spotPriceBasis: snapshot?.spotPriceBasis ?? null,
  });
  const usd = resolved.usd;
  if (usd != null && Number.isFinite(usd) && usd > 0) return usd;
  return null;
}

/**
 * Reference % change for list cards — bundle field first, then sparkline (detail parity).
 */
export function resolveMarketsListingMarketChangePct(
  snapshot: CollectionListMarketSnapshot | undefined,
): number | null {
  const bundled = snapshot?.marketChangePct;
  if (bundled != null && Number.isFinite(bundled)) return bundled;

  const spark = snapshot?.sparklineUsd ?? [];
  if (spark.length < 2) return null;
  return percentChangeReferenceBestWindow(spark).pct;
}

/** Home Top movers — fixed 90-day LOCF reference vs latest (3-month gain). */
export function resolveMarketsListingMarketChangePct90d(
  snapshot: CollectionListMarketSnapshot | undefined,
): number | null {
  const spark = snapshot?.sparklineUsd ?? [];
  if (spark.length < 2) return null;
  const anchor = referenceLagAnchorFromPoints(spark, MARKET_CHANGE_LAG_90D_SEC);
  return anchor?.pct ?? null;
}
