import type {
  CollectionListMarketSnapshot,
  CollectionMarketStats,
  MarketplaceCollectionSummary,
  RwaMetadata,
} from "@/lib/core";
import {
  MARKETS_MOCK_COLLECTIONS,
  MARKETS_MOCK_KEY_PREFIX,
  MARKETS_MOCK_SNAPSHOT_BY_KEY,
} from "@/lib/markets/marketsMockData";
import type {
  PortfolioBidCollectionMeta,
  PortfolioBidRow,
} from "@/lib/portfolio/portfolioBidTypes";
import type { PricedAssetRow, TxRow } from "@/lib/portfolio/portfolioTypes";

/**
 * Portfolio design mocks — holdings/bids/tx point at the same Markets mock
 * collections (`mock:markets:…`) so thumbs and collection detail stay in sync.
 */
export const PORTFOLIO_FORCE_MOCK = true;

/** @deprecated Portfolio holdings now use {@link MARKETS_MOCK_KEY_PREFIX}. */
export const PORTFOLIO_MOCK_KEY_PREFIX = "mock:portfolio:";

export const PORTFOLIO_MOCK_TRADES_COUNT = 12;

export function isPortfolioMockCollectionKey(collectionKey: string): boolean {
  const k = collectionKey.toLowerCase();
  return (
    k.startsWith(PORTFOLIO_MOCK_KEY_PREFIX) ||
    k.startsWith(MARKETS_MOCK_KEY_PREFIX)
  );
}

export function isPortfolioMockTokenId(tokenId: number): boolean {
  return tokenId >= 9_000_001 && tokenId <= 9_000_099;
}

export function shouldUsePortfolioMock(hasRealHoldings: boolean): boolean {
  const env = process.env.NEXT_PUBLIC_PORTFOLIO_FORCE_MOCK;
  if (env === "0") return !hasRealHoldings;
  if (env === "1") return true;
  if (PORTFOLIO_FORCE_MOCK) return true;
  return !hasRealHoldings;
}

function marketsCollectionByListingId(
  listingId: string,
): MarketplaceCollectionSummary {
  const key = `${MARKETS_MOCK_KEY_PREFIX}${listingId}`.toLowerCase();
  const found = MARKETS_MOCK_COLLECTIONS.find(
    (c) => c.collectionKey.toLowerCase() === key,
  );
  if (!found) {
    throw new Error(`Markets mock listing not found: ${listingId}`);
  }
  return found;
}

function snapshotForKey(collectionKey: string): CollectionListMarketSnapshot | undefined {
  return MARKETS_MOCK_SNAPSHOT_BY_KEY.get(collectionKey.toLowerCase());
}

function categoryLabel(c: MarketplaceCollectionSummary): string {
  const cat = c.components?.psaCategory?.trim();
  if (cat === "Basketball") return "NBA";
  if (cat === "Baseball") return "MLB";
  if (cat) return cat;
  return "Pokemon";
}

function gradeParts(c: MarketplaceCollectionSummary): {
  company: string;
  score: string;
} {
  return {
    company: c.components?.gradingCompanyDisplay ?? c.components?.gradingCompany ?? "PSA",
    score: c.components?.gradeScore ?? "10",
  };
}

function marketUsd(c: MarketplaceCollectionSummary): number {
  const snap = snapshotForKey(c.collectionKey);
  return (
    snap?.gradePrices.psa10 ??
    snap?.gradePrices.psa9 ??
    snap?.sparklineUsd.at(-1)?.v ??
    1000
  );
}

function gradeMeta(company: string, score: string): RwaMetadata {
  return {
    attributes: [
      { trait_type: "Grading Company", value: company },
      { trait_type: "Grade", value: score },
    ],
    properties: {
      graded: {
        gradingCompany: company,
        grade: { score, label: `${company} ${score}` },
      },
    },
  };
}

type HoldingSpec = {
  tokenId: number;
  listingId: string;
  /** Cost basis as fraction of current market (P&L demo). */
  costBasisRatio: number;
  listed?: boolean;
};

/** Holdings map onto Markets.html listing cards (same collection keys + prices). */
const HOLDING_SPECS: HoldingSpec[] = [
  { tokenId: 9_000_001, listingId: "listing-3", costBasisRatio: 0.82 },
  { tokenId: 9_000_002, listingId: "listing-5", costBasisRatio: 0.48, listed: true },
  { tokenId: 9_000_003, listingId: "listing-1", costBasisRatio: 0.68 },
  { tokenId: 9_000_004, listingId: "listing-4", costBasisRatio: 0.84 },
  { tokenId: 9_000_005, listingId: "listing-2", costBasisRatio: 0.15 },
];

type BidSpec = { listingId: string; bidRatio: number };

const BID_SPECS: BidSpec[] = [
  { listingId: "listing-6", bidRatio: 0.92 },
  { listingId: "listing-9", bidRatio: 0.88 },
  { listingId: "listing-5", bidRatio: 0.95 },
];

type HoldingResolved = {
  tokenId: number;
  collection: MarketplaceCollectionSummary;
  mktUsd: number;
  costBasisUsd: number;
  listedUsd: number | null;
};

const HOLDINGS: HoldingResolved[] = HOLDING_SPECS.map((spec) => {
  const collection = marketsCollectionByListingId(spec.listingId);
  const mktUsd = marketUsd(collection);
  return {
    tokenId: spec.tokenId,
    collection,
    mktUsd,
    costBasisUsd: Math.round(mktUsd * spec.costBasisRatio),
    listedUsd: spec.listed ? mktUsd : null,
  };
});

type BidResolved = {
  collection: MarketplaceCollectionSummary;
  bidUsd: number;
  askUsd: number;
};

const BIDS: BidResolved[] = BID_SPECS.map((spec) => {
  const collection = marketsCollectionByListingId(spec.listingId);
  const askUsd = marketUsd(collection);
  return {
    collection,
    askUsd,
    bidUsd: Math.round(askUsd * spec.bidRatio),
  };
});

export const PORTFOLIO_MOCK_TOTAL_VALUE = HOLDINGS.reduce((sum, h) => sum + h.mktUsd, 0);

/** Markets collections used by portfolio (holdings + bids) — for cover search / detail. */
export const PORTFOLIO_MOCK_COLLECTIONS: MarketplaceCollectionSummary[] = (() => {
  const byKey = new Map<string, MarketplaceCollectionSummary>();
  for (const h of HOLDINGS) {
    byKey.set(h.collection.collectionKey.toLowerCase(), h.collection);
  }
  for (const b of BIDS) {
    byKey.set(b.collection.collectionKey.toLowerCase(), b.collection);
  }
  return [...byKey.values()];
})();

export const PORTFOLIO_MOCK_SNAPSHOT_BY_KEY: Map<string, CollectionListMarketSnapshot> =
  (() => {
    const m = new Map<string, CollectionListMarketSnapshot>();
    for (const c of PORTFOLIO_MOCK_COLLECTIONS) {
      const snap = snapshotForKey(c.collectionKey);
      if (snap) m.set(c.collectionKey.toLowerCase(), snap);
    }
    return m;
  })();

export const PORTFOLIO_MOCK_ASSET_ROWS: PricedAssetRow[] = HOLDINGS.map((h) => ({
  tokenId: h.tokenId,
  name:
    h.collection.components?.listingDisplayTitle?.trim() ||
    h.collection.displayLabel,
  imageUrl: h.collection.displayImageUrl ?? h.collection.coverImageUrl ?? null,
  category: categoryLabel(h.collection),
  amount: 1,
  currentPrice: h.mktUsd,
  priceSource: "cardhedger" as const,
  liquidityLabel: null,
  listPriceUsd: h.listedUsd,
  activeListingOrderHash: h.listedUsd != null ? `mock-ask-${h.tokenId}` : null,
  setName:
    h.collection.components?.cardSetDisplay?.trim() ||
    h.collection.components?.cardSet?.trim() ||
    null,
  marketPreviewRaw: null,
}));

export const PORTFOLIO_MOCK_METADATA_BY_TOKEN: Map<number, RwaMetadata | null> = (() => {
  const m = new Map<number, RwaMetadata | null>();
  for (const h of HOLDINGS) {
    const { company, score } = gradeParts(h.collection);
    const name =
      h.collection.components?.listingDisplayTitle?.trim() ||
      h.collection.displayLabel;
    m.set(h.tokenId, {
      name,
      image: h.collection.displayImageUrl ?? h.collection.coverImageUrl ?? "",
      ...gradeMeta(company, score),
    });
  }
  return m;
})();

export const PORTFOLIO_MOCK_COST_BASIS_BY_TOKEN: Map<number, number> = (() => {
  const m = new Map<number, number>();
  for (const h of HOLDINGS) m.set(h.tokenId, h.costBasisUsd);
  return m;
})();

export const PORTFOLIO_MOCK_TOKEN_TO_COLLECTION_KEY: Record<number, string> = (() => {
  const out: Record<number, string> = {};
  for (const h of HOLDINGS) {
    out[h.tokenId] = h.collection.collectionKey;
  }
  return out;
})();

export const PORTFOLIO_MOCK_BIDS: PortfolioBidRow[] = BIDS.map((b, i) => ({
  orderHash: `mock-bid-${b.collection.collectionKey}`,
  collectionKey: b.collection.collectionKey,
  tokenId: String(1000 + i),
  priceUsdc: b.bidUsd,
  priceLabel: `$${b.bidUsd.toLocaleString("en-US")}`,
  status: "active" as const,
  createdAt: new Date(Date.UTC(2026, 5, 20 - i)).toISOString(),
}));

export const PORTFOLIO_MOCK_BID_META_BY_KEY: Map<string, PortfolioBidCollectionMeta> =
  (() => {
    const m = new Map<string, PortfolioBidCollectionMeta>();
    for (const b of BIDS) {
      m.set(b.collection.collectionKey, {
        displayLabel:
          b.collection.components?.listingDisplayTitle?.trim() ||
          b.collection.displayLabel,
        imageUrl:
          b.collection.displayImageUrl ?? b.collection.coverImageUrl ?? null,
      });
    }
    return m;
  })();

function emptyStats(collectionKey: string, floor: number): CollectionMarketStats {
  return {
    collectionKey,
    floor,
    median: floor,
    p25: floor,
    p75: floor,
    band: { low: floor, high: floor },
    volatility: null,
    sampleSize: 3,
    isReliable: true,
    dataQuality: { sampleSize: 3, trimmed: false, currency: "USDC" },
    sources: { listings: true },
  };
}

export const PORTFOLIO_MOCK_STATS_BY_KEY: Map<string, CollectionMarketStats> = (() => {
  const m = new Map<string, CollectionMarketStats>();
  for (const h of HOLDINGS) {
    m.set(h.collection.collectionKey, emptyStats(h.collection.collectionKey, h.mktUsd));
  }
  for (const b of BIDS) {
    m.set(b.collection.collectionKey, emptyStats(b.collection.collectionKey, b.askUsd));
  }
  return m;
})();

const HTML_1M_VALS = [
  241_000, 248_200, 252_800, 258_400, 255_100, 261_800, 267_400, 271_200, 264_800, 272_100,
  278_400, 284_610,
];
const HTML_1M_LABELS = [
  "Jun 1",
  "Jun 3",
  "Jun 6",
  "Jun 9",
  "Jun 12",
  "Jun 15",
  "Jun 18",
  "Jun 21",
  "Jun 24",
  "Jun 26",
  "Jun 28",
  "Jun 30",
];

const CHART_SCALE = PORTFOLIO_MOCK_TOTAL_VALUE / HTML_1M_VALS[HTML_1M_VALS.length - 1]!;

export const PORTFOLIO_MOCK_CHART_POINTS: number[] = HTML_1M_VALS.map((v) =>
  Math.round(v * CHART_SCALE),
);

export const PORTFOLIO_MOCK_CHART_LABELS: string[] = HTML_1M_LABELS;

type TxSeed = {
  type: TxRow["type"];
  status: TxRow["status"];
  asset: string;
  category: string | null;
  price: number;
  date: string;
  orderHash: string;
};

const TX_SEEDS: TxSeed[] = [
  {
    type: "SELL",
    status: "pending",
    asset: marketsCollectionByListingId("listing-3").displayLabel,
    category: "PSA 10",
    price: marketUsd(marketsCollectionByListingId("listing-3")),
    date: "Jul 8, 2026",
    orderHash: "mock-tx-sell-pending",
  },
  {
    type: "BUY",
    status: "failed",
    asset: marketsCollectionByListingId("listing-5").displayLabel,
    category: "PSA 10",
    price: marketUsd(marketsCollectionByListingId("listing-5")),
    date: "Jul 5, 2026",
    orderHash: "mock-tx-buy-failed",
  },
  {
    type: "BUY",
    status: "settled",
    asset: marketsCollectionByListingId("listing-1").displayLabel,
    category: "PSA 10",
    price: marketUsd(marketsCollectionByListingId("listing-1")),
    date: "Jun 11, 2026",
    orderHash: "mock-tx-buy-pikachu",
  },
  {
    type: "SELL",
    status: "settled",
    asset: marketsCollectionByListingId("listing-6").displayLabel,
    category: "PSA 10",
    price: marketUsd(marketsCollectionByListingId("listing-6")),
    date: "Jun 4, 2026",
    orderHash: "mock-tx-sell-ssp",
  },
  {
    type: "BUY",
    status: "settled",
    asset: marketsCollectionByListingId("listing-4").displayLabel,
    category: "BGS 9.5",
    price: Math.round(marketUsd(marketsCollectionByListingId("listing-4")) * 0.84),
    date: "May 28, 2026",
    orderHash: "mock-tx-buy-luka",
  },
  {
    type: "BUY",
    status: "vaulted",
    asset: marketsCollectionByListingId("listing-2").displayLabel,
    category: "PSA 10",
    price: 0,
    date: "May 12, 2026",
    orderHash: "mock-tx-vault-nidoking",
  },
];

export const PORTFOLIO_MOCK_TX_ROWS: TxRow[] = TX_SEEDS.map((t) => ({
  type: t.type,
  status: t.status,
  asset: t.asset,
  category: t.category,
  amount: 1,
  price: t.price,
  date: t.date,
  orderHash: t.orderHash,
}));

/** Apply Cardhedger cover map onto portfolio display rows / bid meta / metadata. */
export function withPortfolioMockCoverImages(
  coverByKey: ReadonlyMap<string, string>,
): {
  assetRows: PricedAssetRow[];
  metadataByTokenId: Map<number, RwaMetadata | null>;
  bidMetaByKey: Map<string, PortfolioBidCollectionMeta>;
} {
  if (coverByKey.size === 0) {
    return {
      assetRows: PORTFOLIO_MOCK_ASSET_ROWS,
      metadataByTokenId: PORTFOLIO_MOCK_METADATA_BY_TOKEN,
      bidMetaByKey: PORTFOLIO_MOCK_BID_META_BY_KEY,
    };
  }

  const assetRows = PORTFOLIO_MOCK_ASSET_ROWS.map((row) => {
    if (row.imageUrl?.trim()) return row;
    const ck = PORTFOLIO_MOCK_TOKEN_TO_COLLECTION_KEY[row.tokenId]?.toLowerCase();
    const url = ck ? coverByKey.get(ck) : undefined;
    if (!url) return row;
    return { ...row, imageUrl: url };
  });

  const metadataByTokenId = new Map<number, RwaMetadata | null>();
  for (const [tokenId, meta] of PORTFOLIO_MOCK_METADATA_BY_TOKEN) {
    const existing = meta?.image?.trim();
    if (existing) {
      metadataByTokenId.set(tokenId, meta);
      continue;
    }
    const ck = PORTFOLIO_MOCK_TOKEN_TO_COLLECTION_KEY[tokenId]?.toLowerCase();
    const url = ck ? coverByKey.get(ck) : undefined;
    if (!meta || !url) {
      metadataByTokenId.set(tokenId, meta);
      continue;
    }
    metadataByTokenId.set(tokenId, { ...meta, image: url });
  }

  const bidMetaByKey = new Map<string, PortfolioBidCollectionMeta>();
  for (const [key, meta] of PORTFOLIO_MOCK_BID_META_BY_KEY) {
    if (meta.imageUrl?.trim()) {
      bidMetaByKey.set(key, meta);
      continue;
    }
    const url = coverByKey.get(key.toLowerCase());
    bidMetaByKey.set(key, url ? { ...meta, imageUrl: url } : meta);
  }

  return { assetRows, metadataByTokenId, bidMetaByKey };
}
