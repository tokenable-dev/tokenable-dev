import { ASSETS } from "@/constants/assets";
import type {
  CollectionListMarketSnapshot,
  CollectionMarketStats,
  MarketplaceCollectionSummary,
  RwaMetadata,
} from "@/lib/core";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import type {
  PortfolioBidCollectionMeta,
  PortfolioBidRow,
} from "@/lib/portfolio/portfolioBidTypes";
import type { PricedAssetRow, TxRow } from "@/lib/portfolio/portfolioTypes";

/**
 * Design parity with `Tokenable-with design system/Portfolio.html`.
 * Real portfolio hooks stay intact — flip to `false` (or env `0`) for live data.
 */
export const PORTFOLIO_FORCE_MOCK = true;

export const PORTFOLIO_MOCK_KEY_PREFIX = "mock:portfolio:";

/** Portfolio.html stat card: Trades */
export const PORTFOLIO_MOCK_TRADES_COUNT = 12;

/** Portfolio.html chart headline (sum of mock holdings mkt prices). */
export const PORTFOLIO_MOCK_TOTAL_VALUE = 556_290;

export function isPortfolioMockCollectionKey(collectionKey: string): boolean {
  return collectionKey.toLowerCase().startsWith(PORTFOLIO_MOCK_KEY_PREFIX);
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

type HoldingSeed = {
  tokenId: number;
  id: string;
  name: string;
  image: string;
  gradeCompany: string;
  gradeScore: string;
  costBasisUsd: number;
  mktUsd: number;
  listedUsd?: number;
  category: string;
};

const HOLDING_SEEDS: HoldingSeed[] = [
  {
    tokenId: 9_000_001,
    id: "charizard-ex-sir",
    name: "2023 POKEMON MEW EN-151 #199 CHARIZARD EX SPECIAL ILLUSTRATION RARE",
    image: ASSETS.ds.cards.charizard,
    gradeCompany: "PSA",
    gradeScore: "10",
    costBasisUsd: 180_000,
    mktUsd: 420_000,
    category: "Pokemon",
  },
  {
    tokenId: 9_000_002,
    id: "lebron-chrome-rr",
    name: "2003 TOPPS CHROME #111 LEBRON JAMES ROOKIE REFRACTOR",
    image: ASSETS.ds.cards.lebron,
    gradeCompany: "PSA",
    gradeScore: "10",
    costBasisUsd: 31_000,
    mktUsd: 58_000,
    listedUsd: 58_000,
    category: "NBA",
  },
  {
    tokenId: 9_000_003,
    id: "pikachu-ex-sar",
    name: "2025 POKEMON JAPANESE M2A-MEGA DREAM EX #234 PIKACHU EX SPECIAL ART RARE",
    image: ASSETS.ds.cards.pikachu,
    gradeCompany: "PSA",
    gradeScore: "10",
    costBasisUsd: 770,
    mktUsd: 1_136,
    category: "Pokemon",
  },
  {
    tokenId: 9_000_004,
    id: "luka-blue-ice",
    name: "2018 PANINI PRIZM #280 LUKA DONCIC BLUE ICE ROOKIE",
    image: ASSETS.ds.cards.luka,
    gradeCompany: "BGS",
    gradeScore: "9.5",
    costBasisUsd: 16_100,
    mktUsd: 19_154,
    category: "NBA",
  },
  {
    tokenId: 9_000_005,
    id: "nidoking-ex-sr",
    name: "2024 POKEMON JAPANESE SV7A #101 NIDOKING EX STELLAR RARE",
    image: ASSETS.ds.cards.nidoking,
    gradeCompany: "PSA",
    gradeScore: "9",
    costBasisUsd: 8_500,
    mktUsd: 58_000,
    category: "Pokemon",
  },
];

function collectionKeyFor(id: string): string {
  return `${PORTFOLIO_MOCK_KEY_PREFIX}${id}`;
}

type BidSeed = {
  id: string;
  name: string;
  image: string;
  bidUsd: number;
  askUsd: number;
};

const BID_SEEDS: BidSeed[] = [
  {
    id: "charizard-ex-sir",
    name: "2023 POKEMON MEW EN-151 #199 CHARIZARD EX SPECIAL ILLUSTRATION RARE",
    image: ASSETS.ds.cards.charizard,
    bidUsd: 820,
    askUsd: 880,
  },
  {
    id: "pikachu-ex-sar-bid",
    name: "2025 POKEMON JAPANESE M2A-MEGA DREAM EX #234 PIKACHU EX SPECIAL ART RARE #238",
    image: ASSETS.ds.cards.pikachuEx,
    bidUsd: 1_050,
    // Floor ≤ bid so UI shows HIGHEST (Portfolio.html tag).
    askUsd: 1_050,
  },
  {
    id: "lebron-auto",
    name: "2003 UPPER DECK ULTIMATE COLLECTION #127 LEBRON JAMES ROOKIE AUTO",
    image: ASSETS.ds.cards.lebron,
    bidUsd: 62_000,
    askUsd: 62_000,
  },
];

function toSummary(seed: HoldingSeed | BidSeed, listed = 1): MarketplaceCollectionSummary {
  const gradeCompany = "gradeCompany" in seed ? seed.gradeCompany : "PSA";
  const gradeScore = "gradeScore" in seed ? seed.gradeScore : "10";
  const components: CollectionComponents = {
    cardName: seed.name,
    cardNameDisplay: seed.name,
    gradingCompany: gradeCompany,
    gradingCompanyDisplay: gradeCompany,
    gradeScore,
    psaGradeLabel: `${gradeCompany} ${gradeScore}`,
    listingDisplayTitle: seed.name,
  };
  return {
    collectionKey: collectionKeyFor(seed.id),
    displayLabel: seed.name,
    queryUsed: null,
    components,
    createdAt: new Date(Date.UTC(2026, 4, 12)).toISOString(),
    activeListingCount: listed,
    coverImageUrl: seed.image,
    displayImageUrl: seed.image,
  };
}

function toSnapshot(
  seed: HoldingSeed | BidSeed,
): CollectionListMarketSnapshot {
  const priceUsd = "mktUsd" in seed ? seed.mktUsd : seed.askUsd;
  const gradeScore = "gradeScore" in seed ? seed.gradeScore : "10";
  const now = Math.floor(Date.now() / 1000);
  return {
    collectionKey: collectionKeyFor(seed.id),
    categoryLabel: "category" in seed ? seed.category : null,
    marketChangePct: 0.7,
    marketChangeWindow: "30d",
    marketChangeIsFullYear: false,
    gradePrices: {
      psa10: gradeScore === "10" ? priceUsd : null,
      psa9: gradeScore === "9" || gradeScore === "9.5" ? priceUsd : null,
      raw: null,
    },
    sparklineUsd: [
      { t: now - 90 * 86_400, v: priceUsd * 0.92 },
      { t: now, v: priceUsd },
    ],
    marketStats: null,
  };
}

/** Unique collection summaries for detail-page short-circuit. */
export const PORTFOLIO_MOCK_COLLECTIONS: MarketplaceCollectionSummary[] = (() => {
  const byKey = new Map<string, MarketplaceCollectionSummary>();
  for (const s of HOLDING_SEEDS) {
    byKey.set(collectionKeyFor(s.id), toSummary(s, s.listedUsd != null ? 1 : 2));
  }
  for (const s of BID_SEEDS) {
    const key = collectionKeyFor(s.id);
    if (!byKey.has(key)) byKey.set(key, toSummary(s, 1));
  }
  return [...byKey.values()];
})();

export const PORTFOLIO_MOCK_SNAPSHOT_BY_KEY: Map<string, CollectionListMarketSnapshot> =
  (() => {
    const m = new Map<string, CollectionListMarketSnapshot>();
    for (const s of HOLDING_SEEDS) {
      m.set(collectionKeyFor(s.id).toLowerCase(), toSnapshot(s));
    }
    for (const s of BID_SEEDS) {
      const key = collectionKeyFor(s.id).toLowerCase();
      if (!m.has(key)) m.set(key, toSnapshot(s));
    }
    return m;
  })();

export const PORTFOLIO_MOCK_ASSET_ROWS: PricedAssetRow[] = HOLDING_SEEDS.map((s) => ({
  tokenId: s.tokenId,
  name: s.name,
  imageUrl: s.image,
  category: s.category,
  amount: 1,
  currentPrice: s.mktUsd,
  priceSource: "cardhedger" as const,
  liquidityLabel: null,
  listPriceUsd: s.listedUsd ?? null,
  activeListingOrderHash: s.listedUsd != null ? `mock-ask-${s.tokenId}` : null,
  setName: null,
  marketPreviewRaw: null,
}));

export const PORTFOLIO_MOCK_METADATA_BY_TOKEN: Map<number, RwaMetadata | null> = (() => {
  const m = new Map<number, RwaMetadata | null>();
  for (const s of HOLDING_SEEDS) {
    m.set(s.tokenId, {
      name: s.name,
      image: s.image,
      ...gradeMeta(s.gradeCompany, s.gradeScore),
    });
  }
  return m;
})();

export const PORTFOLIO_MOCK_COST_BASIS_BY_TOKEN: Map<number, number> = (() => {
  const m = new Map<number, number>();
  for (const s of HOLDING_SEEDS) {
    m.set(s.tokenId, s.costBasisUsd);
  }
  return m;
})();

export const PORTFOLIO_MOCK_TOKEN_TO_COLLECTION_KEY: Record<number, string> = (() => {
  const out: Record<number, string> = {};
  for (const s of HOLDING_SEEDS) {
    out[s.tokenId] = collectionKeyFor(s.id);
  }
  return out;
})();

export const PORTFOLIO_MOCK_BIDS: PortfolioBidRow[] = BID_SEEDS.map((s, i) => ({
  orderHash: `mock-bid-${s.id}`,
  collectionKey: collectionKeyFor(s.id),
  priceUsdc: s.bidUsd,
  priceLabel: `$${s.bidUsd.toLocaleString("en-US")}`,
  status: "active" as const,
  createdAt: new Date(Date.UTC(2026, 5, 20 - i)).toISOString(),
}));

export const PORTFOLIO_MOCK_BID_META_BY_KEY: Map<string, PortfolioBidCollectionMeta> = (() => {
  const m = new Map<string, PortfolioBidCollectionMeta>();
  for (const s of BID_SEEDS) {
    m.set(collectionKeyFor(s.id), {
      displayLabel: s.name,
      imageUrl: s.image,
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
  for (const s of HOLDING_SEEDS) {
    const key = collectionKeyFor(s.id);
    m.set(key, emptyStats(key, s.mktUsd));
  }
  for (const s of BID_SEEDS) {
    const key = collectionKeyFor(s.id);
    m.set(key, emptyStats(key, s.askUsd));
  }
  return m;
})();

/**
 * Portfolio.html `pfData` scaled so the series ends at {@link PORTFOLIO_MOCK_TOTAL_VALUE}.
 * Panel slices this for 1D / 1W / 1M.
 */
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
  asset: string;
  category: string | null;
  price: number;
  date: string;
  orderHash: string;
};

const TX_SEEDS: TxSeed[] = [
  {
    type: "SELL",
    asset: "Pokémon Gold Star Charizard",
    category: "PSA 10",
    price: 450_000,
    date: "Jul 8, 2026",
    orderHash: "mock-tx-sell-pending",
  },
  {
    type: "BUY",
    asset: "2003 TOPPS CHROME #111 LEBRON JAMES ROOKIE REFRACTOR",
    category: "PSA 10",
    price: 58_000,
    date: "Jul 5, 2026",
    orderHash: "mock-tx-buy-failed",
  },
  {
    type: "BUY",
    asset: "2025 POKEMON JAPANESE M2A-MEGA DREAM EX #234 PIKACHU EX SPECIAL ART RARE",
    category: "PSA 10",
    price: 1_136,
    date: "Jun 11, 2026",
    orderHash: "mock-tx-buy-pikachu",
  },
  {
    type: "SELL",
    asset: "Pokémon Gold Star Charizard",
    category: "PSA 10",
    price: 14_200,
    date: "Jun 4, 2026",
    orderHash: "mock-tx-sell-charizard",
  },
  {
    type: "BUY",
    asset: "2003 TOPPS CHROME #111 LEBRON JAMES ROOKIE REFRACTOR",
    category: "PSA 10",
    price: 31_000,
    date: "May 28, 2026",
    orderHash: "mock-tx-buy-lebron",
  },
  {
    type: "BUY",
    asset: "2023 POKEMON MEW EN-151 #199 CHARIZARD EX SPECIAL ILLUSTRATION RARE",
    category: "PSA 10",
    price: 180_000,
    date: "May 12, 2026",
    orderHash: "mock-tx-vault-charizard",
  },
];

export const PORTFOLIO_MOCK_TX_ROWS: TxRow[] = TX_SEEDS.map((t) => ({
  type: t.type,
  asset: t.asset,
  category: t.category,
  amount: 1,
  price: t.price,
  date: t.date,
  orderHash: t.orderHash,
}));
