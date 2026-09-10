import type {
  CollectionMarketPreview,
  CollectionMarketSeries,
  CollectionMarketStats,
} from "@/lib/core";
import { formatLiquidityDepthLabel, resolveExternalMarketUsd } from "@/lib/market";
import {
  buildRwaAssetDetailHeadlineParts,
  formatAssetDetailHeadlineText,
  resolveRwaHeadlineGrade,
} from "@/lib/marketplace/assetDetailHeadline";
import { displayAssetNameFromMetadata } from "@/lib/marketplace/rwaDisplayTitle";
import {
  extractCategory,
  gradeScoreFromMetadata,
  marketTierComponentsFromMetadata,
  pickPortfolioMarketPreview,
} from "@/lib/portfolio/portfolioAssetMeta";
import { extractSparklineValues1y } from "@/lib/portfolio/portfolioTableHelpers";
import type { OwnedAsset, PricedAssetRow } from "@/lib/portfolio/portfolioTypes";

const USDC_DECIMALS = 1_000_000;

/** Newest active ask per token. Last-write-wins would keep the oldest when the API is DESC. */
export function listingByTokenIdFromAsks(
  listings: Array<{
    tokenId: string | number;
    price: string;
    orderHash: string;
    status?: string;
    side?: string;
    createdAt?: string;
    updatedAt?: string;
    id?: number;
  }>,
): Map<number, { priceUsd: number; orderHash: string }> {
  const ranked = new Map<
    number,
    { priceUsd: number; orderHash: string; rank: number }
  >();
  for (const o of listings) {
    if (o.status && o.status !== "active") continue;
    if (o.side && o.side !== "ask") continue;
    const tid = Number(o.tokenId);
    if (!Number.isFinite(tid)) continue;
    const ts = Date.parse(o.updatedAt || o.createdAt || "");
    const rank = Number.isFinite(ts) ? ts : o.id ?? 0;
    const prev = ranked.get(tid);
    if (prev && prev.rank >= rank) continue;
    const priceUsd = Number(o.price) / USDC_DECIMALS;
    if (!Number.isFinite(priceUsd)) continue;
    ranked.set(tid, { priceUsd, orderHash: o.orderHash, rank });
  }
  const m = new Map<number, { priceUsd: number; orderHash: string }>();
  for (const [tid, v] of ranked) {
    m.set(tid, { priceUsd: v.priceUsd, orderHash: v.orderHash });
  }
  return m;
}

export function buildPortfolioPricedRows(input: {
  assets: OwnedAsset[];
  listingByTokenId: Map<number, { priceUsd: number; orderHash: string }>;
  tokenToCollectionKey: Record<number, string>;
  statsByCollectionKey: Map<string, CollectionMarketStats>;
  seriesByCollectionKey: Map<string, CollectionMarketSeries>;
  mintPreviewByToken: Record<number, CollectionMarketPreview | undefined>;
}): PricedAssetRow[] {
  const {
    assets,
    listingByTokenId,
    tokenToCollectionKey,
    statsByCollectionKey,
    seriesByCollectionKey,
    mintPreviewByToken,
  } = input;

  return assets.map((a) => {
    const listing = listingByTokenId.get(a.tokenId);
    const listingPrice = listing?.priceUsd ?? null;
    const activeListingOrderHash = listing?.orderHash ?? null;
    const ck = tokenToCollectionKey[a.tokenId]?.toLowerCase() ?? null;
    const stats = ck ? statsByCollectionKey.get(ck) ?? null : null;
    const series = ck ? seriesByCollectionKey.get(ck) ?? null : null;

    const preview = pickPortfolioMarketPreview(
      series,
      mintPreviewByToken[a.tokenId] ?? null,
    );

    const resolved = resolveExternalMarketUsd({
      marketPreview: preview,
      gradePrices: series?.gradePrices ?? null,
      gradeScore: gradeScoreFromMetadata(a.metadata),
      components: marketTierComponentsFromMetadata(a.metadata),
      spotPriceBasis: series?.spotPriceBasis ?? null,
    });

    let currentPrice: number | null = null;
    let priceSource: PricedAssetRow["priceSource"] = "none";
    if (
      resolved.usd != null &&
      Number.isFinite(resolved.usd) &&
      resolved.usd > 0
    ) {
      currentPrice = resolved.usd;
      priceSource =
        resolved.source === "psa_estimate" ? "psa_estimate" : "cardhedger";
    }

    const liquidityLabel = ck
      ? formatLiquidityDepthLabel(stats ?? undefined)
      : null;

    const fallbackName = `RWA #${a.tokenId}`;
    const parts = buildRwaAssetDetailHeadlineParts(a.metadata, fallbackName);
    const grade = resolveRwaHeadlineGrade(a.metadata);
    const displayName =
      formatAssetDetailHeadlineText(parts, { grade }) ||
      displayAssetNameFromMetadata(a.metadata, fallbackName);
    const sparkline1y = extractSparklineValues1y(series);

    return {
      tokenId: a.tokenId,
      name: displayName,
      imageUrl: a.imageUrl,
      category: extractCategory(a.metadata),
      amount: 1,
      currentPrice,
      priceSource,
      liquidityLabel,
      listPriceUsd: listingPrice,
      activeListingOrderHash,
      setName: null,
      marketPreviewRaw: preview,
      sparkline1y,
    };
  });
}

export { USDC_DECIMALS as PORTFOLIO_USDC_DECIMALS };
