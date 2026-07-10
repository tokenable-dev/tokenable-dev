import type {
  CollectionListMarketSnapshot,
  CollectionMarketSeries,
  CollectionPlatformTapeFill,
  CollectionTradesVolumeStats,
  MarketplaceCollectionDetail,
  MarketplaceCollectionSummary,
  Order,
} from "@/lib/core";
import {
  HOME_MOCK_JUST_VAULTED,
  HOME_MOCK_SNAPSHOT_BY_KEY,
  HOME_MOCK_TOP_MOVERS,
  isHomeMockCollectionKey,
} from "@/lib/home/homeMockData";
import {
  MARKETS_MOCK_COLLECTIONS,
  MARKETS_MOCK_SNAPSHOT_BY_KEY,
  isMarketsMockCollectionKey,
} from "@/lib/markets/marketsMockData";
import {
  PORTFOLIO_MOCK_COLLECTIONS,
  PORTFOLIO_MOCK_SNAPSHOT_BY_KEY,
  isPortfolioMockCollectionKey,
} from "@/lib/portfolio/portfolioMockData";

export function isDesignMockCollectionKey(collectionKey: string): boolean {
  return (
    isHomeMockCollectionKey(collectionKey) ||
    isMarketsMockCollectionKey(collectionKey) ||
    isPortfolioMockCollectionKey(collectionKey)
  );
}

const MOCK_SUMMARY_BY_KEY: Map<string, MarketplaceCollectionSummary> = (() => {
  const map = new Map<string, MarketplaceCollectionSummary>();
  for (const c of [
    ...HOME_MOCK_TOP_MOVERS,
    ...HOME_MOCK_JUST_VAULTED,
    ...MARKETS_MOCK_COLLECTIONS,
    ...PORTFOLIO_MOCK_COLLECTIONS,
  ]) {
    map.set(c.collectionKey.toLowerCase(), c);
  }
  return map;
})();

function snapshotFor(key: string): CollectionListMarketSnapshot | undefined {
  const k = key.toLowerCase();
  return (
    HOME_MOCK_SNAPSHOT_BY_KEY.get(k) ??
    MARKETS_MOCK_SNAPSHOT_BY_KEY.get(k) ??
    PORTFOLIO_MOCK_SNAPSHOT_BY_KEY.get(k)
  );
}

function usdcMicros(usd: number): string {
  return String(Math.round(usd * 1_000_000));
}

function emptyVolumeWindow() {
  return { notionalUsdc: 0, tradeCount: 0, platformCount: 0, cardhedgerCount: 0 };
}

function buildVolume(trades: CollectionPlatformTapeFill[]): CollectionTradesVolumeStats {
  const now = Math.floor(Date.now() / 1000);
  const windows = {
    "7d": emptyVolumeWindow(),
    "30d": emptyVolumeWindow(),
    "90d": emptyVolumeWindow(),
    "180d": emptyVolumeWindow(),
    "365d": emptyVolumeWindow(),
  };
  const total = emptyVolumeWindow();
  const buckets: { key: keyof typeof windows; sec: number }[] = [
    { key: "7d", sec: 7 * 86_400 },
    { key: "30d", sec: 30 * 86_400 },
    { key: "90d", sec: 90 * 86_400 },
    { key: "180d", sec: 180 * 86_400 },
    { key: "365d", sec: 365 * 86_400 },
  ];
  for (const trade of trades) {
    total.notionalUsdc += trade.priceUsdc;
    total.tradeCount += 1;
    total.cardhedgerCount += 1;
    for (const b of buckets) {
      if (now - trade.t <= b.sec) {
        windows[b.key].notionalUsdc += trade.priceUsdc;
        windows[b.key].tradeCount += 1;
        windows[b.key].cardhedgerCount += 1;
      }
    }
  }
  return { windows, total };
}

function buildMockAsks(
  summary: MarketplaceCollectionSummary,
  priceUsd: number,
): Order[] {
  const listed = Math.max(1, Math.min(summary.activeListingCount || 1, 3));
  const cover = summary.coverImageUrl ?? summary.displayImageUrl ?? "";
  const zero = "0x0000000000000000000000000000000000000000";
  const token = "0x0000000000000000000000000000000000000001";
  const usdc = "0x0000000000000000000000000000000000000002";
  const now = Math.floor(Date.now() / 1000);
  const asks: Order[] = [];
  for (let i = 0; i < listed; i++) {
    const tokenId = String(9_000_000 + i);
    const price = priceUsd * (1 + i * 0.02);
    const offerer = `0xd5ab4ce3606cf74000000000000000000000000${i}`;
    asks.push({
      id: 900_000 + i,
      orderHash: `mock-ask-${summary.collectionKey}-${i}`,
      offerer,
      side: "ask",
      collectionKey: summary.collectionKey,
      tokenContract: token,
      tokenId,
      considerationToken: usdc,
      considerationAmount: usdcMicros(price),
      parameters: {
        offerer,
        zone: zero,
        zoneHash: zero,
        startTime: String(now - 86_400),
        endTime: String(now + 30 * 86_400),
        orderType: 0,
        offer: [],
        consideration: [],
        totalOriginalConsiderationItems: 0,
        salt: "0",
        conduitKey: zero,
        counter: "0",
      },
      signature: "0x",
      status: "active",
      startTime: new Date((now - 86_400) * 1000).toISOString(),
      endTime: new Date((now + 30 * 86_400) * 1000).toISOString(),
      createdAt: new Date((now - (i + 1) * 3_600) * 1000).toISOString(),
    });
    void cover;
  }
  return asks;
}

function buildMockTrades(
  summary: MarketplaceCollectionSummary,
  priceUsd: number,
): CollectionPlatformTapeFill[] {
  const now = Math.floor(Date.now() / 1000);
  const platforms = ["eBay", "PWCC", "Goldin", "Heritage", "CardLadder"];
  const trades: CollectionPlatformTapeFill[] = [];
  for (let i = 0; i < 8; i++) {
    const drift = 1 + ((i % 5) - 2) * 0.015;
    trades.push({
      t: now - (i + 1) * 3 * 86_400,
      priceUsdc: Math.round(priceUsd * drift),
      tokenId: String(9_000_000 + (i % 3)),
      orderHash: `mock-trade-${summary.collectionKey}-${i}`,
      tapeAggressor: i % 2 === 0 ? "buy" : "sell",
      source: "cardhedger",
      externalSaleType: i % 3 === 0 ? "Auction" : "Best Offer",
      externalSalePlatform: platforms[i % platforms.length]!,
      externalSaleUrl: null,
    });
  }
  return trades;
}

export function getMockCollectionSummary(
  collectionKey: string,
): MarketplaceCollectionSummary | null {
  return MOCK_SUMMARY_BY_KEY.get(collectionKey.toLowerCase()) ?? null;
}

export function getMockCollectionDetail(
  collectionKey: string,
): MarketplaceCollectionDetail | null {
  const summary = getMockCollectionSummary(collectionKey);
  if (!summary) return null;
  const snap = snapshotFor(collectionKey);
  const priceUsd =
    snap?.gradePrices.psa10 ??
    snap?.gradePrices.psa9 ??
    snap?.sparklineUsd.at(-1)?.v ??
    1000;
  const asks = buildMockAsks(summary, priceUsd);
  return {
    collection: {
      collectionKey: summary.collectionKey,
      displayLabel: summary.displayLabel,
      queryUsed: summary.queryUsed,
      components: summary.components,
      createdAt: summary.createdAt,
      coverImageUrl: summary.coverImageUrl ?? summary.displayImageUrl ?? null,
    },
    listings: asks,
    collectionBids: [],
    representativeImageUrl: summary.displayImageUrl ?? summary.coverImageUrl ?? null,
  };
}

export function getMockCollectionMarketSeries(
  collectionKey: string,
): CollectionMarketSeries | null {
  const summary = getMockCollectionSummary(collectionKey);
  const snap = snapshotFor(collectionKey);
  if (!summary || !snap) return null;
  const gradeLabel = `${summary.components.gradingCompanyDisplay ?? summary.components.gradingCompany ?? "PSA"} ${summary.components.gradeScore ?? "10"}`;
  const externalUsd = snap.sparklineUsd.length >= 2
    ? snap.sparklineUsd
    : [
        { t: Math.floor(Date.now() / 1000) - 90 * 86_400, v: 1000 },
        { t: Math.floor(Date.now() / 1000), v: 1000 },
      ];
  const last = externalUsd[externalUsd.length - 1]!.v;
  return {
    collectionKey: summary.collectionKey,
    categoryLabel: snap.categoryLabel,
    marketChangePct: snap.marketChangePct,
    marketChangeWindow: snap.marketChangeWindow,
    marketChangeIsFullYear: snap.marketChangeIsFullYear,
    marketChangeSpanSec:
      snap.marketChangeWindow === "180d"
        ? 180 * 86_400
        : snap.marketChangeWindow === "90d"
          ? 90 * 86_400
          : 365 * 86_400,
    marketChangeRefUsd: externalUsd[0]?.v ?? null,
    marketChangeRefAtSec: externalUsd[0]?.t ?? null,
    marketChangeSource: "cardhedger_graded",
    gradePrices: snap.gradePrices,
    allGradePrices: [
      {
        grade: gradeLabel,
        priceUsd: last,
        grader: summary.components.gradingCompany ?? "PSA",
        displayOrder: 0,
      },
    ],
    collectionGrade: gradeLabel,
    externalUsd,
    platformUsd: externalUsd,
    cardhedgerPreview: undefined,
  };
}

export function getMockCollectionPlatformTrades(collectionKey: string): {
  platformUsd: { t: number; v: number }[];
  trades: CollectionPlatformTapeFill[];
  volume: CollectionTradesVolumeStats;
} | null {
  const summary = getMockCollectionSummary(collectionKey);
  const snap = snapshotFor(collectionKey);
  if (!summary || !snap) return null;
  const priceUsd =
    snap.gradePrices.psa10 ??
    snap.gradePrices.psa9 ??
    snap.sparklineUsd.at(-1)?.v ??
    1000;
  const trades = buildMockTrades(summary, priceUsd);
  return {
    platformUsd: snap.sparklineUsd,
    trades,
    volume: buildVolume(trades),
  };
}

/** Listing grid images without calling RWA metadata API. */
export function getMockListingMetadataMap(
  collectionKey: string,
  tokenIds: number[],
): Map<number, { metadata: null; imageUrl: string | null }> {
  const summary = getMockCollectionSummary(collectionKey);
  const cover = summary?.displayImageUrl ?? summary?.coverImageUrl ?? null;
  const map = new Map<number, { metadata: null; imageUrl: string | null }>();
  for (const id of tokenIds) {
    map.set(id, { metadata: null, imageUrl: cover });
  }
  return map;
}
