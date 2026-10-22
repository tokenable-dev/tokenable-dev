import type {
  CollectionListMarketSnapshot,
  MarketplaceCollectionSummary,
} from "@/lib/core";
import {
  parseGradeScoreNumber,
  percentChangeReferenceBestWindow,
  resolveExternalMarketUsd,
} from "@/lib/market";
import { parseCollectionComponents } from "@/lib/marketplace/collectionDetailComponents";

/**
 * Markets grid / landing carousel spot USD — same resolution order as collection detail
 * ({@link resolveExternalMarketUsd} + `market-series` preview).
 */
export function resolveMarketsListingMarketUsd(
  collection: MarketplaceCollectionSummary,
  snapshot: CollectionListMarketSnapshot | undefined,
): number | null {
  const comp = parseCollectionComponents(collection.components);
  if (comp.assetKind === "sealed_box") {
    const raw = snapshot?.gradePrices?.raw;
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
    const spark = snapshot?.sparklineUsd;
    if (spark && spark.length > 0) {
      const last = spark[spark.length - 1]?.v;
      if (typeof last === "number" && Number.isFinite(last) && last > 0) return last;
    }
    const cents = comp.loosePriceCents;
    if (typeof cents === "number" && Number.isFinite(cents) && cents > 0) {
      return cents / 100;
    }
    return null;
  }
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
