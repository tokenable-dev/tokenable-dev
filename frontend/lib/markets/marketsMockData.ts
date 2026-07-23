import type {
  CollectionListMarketSnapshot,
  MarketplaceCollectionSummary,
} from "@/lib/core";
import { enrichDesignMockComponents } from "@/lib/marketplace/enrichDesignMockComponents";
import { MOCK_COLLECTR_CHARIZARD_EX_151_199 } from "@/lib/home/withMockCoverImages";
import type { HomeMockCardSub } from "@/lib/home/homeMockData";

/**
 * Design parity with `Tokenable-with design system/Markets.html` `listings`.
 * Real marketplace infinite query stays intact — flip to `false` to prefer live catalog
 * (mocks only when the catalog is empty).
 */
export const MARKETS_FORCE_MOCK_CARDS = true;

export const MARKETS_MOCK_KEY_PREFIX = "mock:markets:";

/** Markets.html results meta: `<b>1,284</b> results` */
export const MARKETS_MOCK_RESULTS_COUNT = 1284;

export function isMarketsMockCollectionKey(collectionKey: string): boolean {
  return collectionKey.toLowerCase().startsWith(MARKETS_MOCK_KEY_PREFIX);
}

type MarketsMockSeed = {
  id: string;
  image: string;
  gradeCompany: string;
  gradeScore: string;
  pop: number;
  listed: number;
  title: string;
  set: string;
  priceUsd: number;
  changePct: number | null;
  changeWindow?: CollectionListMarketSnapshot["marketChangeWindow"];
  /** When set, overrides % change sub (e.g. HTML `POP 3 · scarce`). */
  customSub?: HomeMockCardSub;
  categoryHint?: "pokemon" | "nba" | "mlb";
  hoursAgo?: number;
};

function gradeParts(grade: string): { gradeCompany: string; gradeScore: string } {
  const parts = grade.trim().split(/\s+/);
  if (parts.length >= 2) {
    return { gradeCompany: parts[0]!, gradeScore: parts.slice(1).join(" ") };
  }
  return { gradeCompany: "PSA", gradeScore: grade };
}

function parsePop(raw: string): number {
  const cleaned = raw.replace(/,/g, "").trim().toLowerCase();
  if (cleaned.endsWith("k")) {
    return Math.round(parseFloat(cleaned) * 1_000);
  }
  return Math.round(parseFloat(cleaned));
}

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function buildSparkline(priceUsd: number, changePct: number | null): { t: number; v: number }[] {
  const now = Math.floor(Date.now() / 1000);
  const lag = 90 * 86_400;
  if (changePct == null || !Number.isFinite(changePct) || changePct === -100) {
    return [
      { t: now - lag, v: priceUsd },
      { t: now, v: priceUsd },
    ];
  }
  const past = priceUsd / (1 + changePct / 100);
  return [
    { t: now - lag, v: Math.max(past, 0.01) },
    { t: now, v: priceUsd },
  ];
}

function toCollection(seed: MarketsMockSeed): MarketplaceCollectionSummary {
  const components = enrichDesignMockComponents({
    cardName: seed.title,
    cardNameDisplay: seed.title,
    cardSet: seed.set,
    cardSetDisplay: seed.set,
    gradingCompany: seed.gradeCompany,
    gradingCompanyDisplay: seed.gradeCompany,
    gradeScore: seed.gradeScore,
    psaGradeLabel: `${seed.gradeCompany} ${seed.gradeScore}`,
    psaTotalPopulation: seed.pop,
    listingDisplayTitle: seed.title,
    psaCategory:
      seed.categoryHint === "nba"
        ? "Basketball"
        : seed.categoryHint === "mlb"
          ? "Baseball"
          : "Pokemon",
  });
  return {
    collectionKey: `${MARKETS_MOCK_KEY_PREFIX}${seed.id}`,
    displayLabel: seed.title,
    queryUsed: null,
    components,
    createdAt: hoursAgoIso(seed.hoursAgo ?? 24),
    activeListingCount: seed.listed,
    coverImageUrl: seed.image,
    displayImageUrl: seed.image,
  };
}

function toSnapshot(seed: MarketsMockSeed): CollectionListMarketSnapshot {
  const key = `${MARKETS_MOCK_KEY_PREFIX}${seed.id}`;
  return {
    collectionKey: key,
    categoryLabel:
      seed.categoryHint === "nba"
        ? "Basketball"
        : seed.categoryHint === "mlb"
          ? "Baseball"
          : "Pokemon",
    marketChangePct: seed.changePct,
    marketChangeWindow: seed.changeWindow,
    marketChangeIsFullYear: seed.changeWindow === "365d",
    gradePrices: {
      psa10: seed.gradeScore === "10" ? seed.priceUsd : null,
      psa9:
        seed.gradeScore === "9" || seed.gradeScore === "9.5" ? seed.priceUsd : null,
      raw: null,
    },
    sparklineUsd: buildSparkline(seed.priceUsd, seed.changePct),
    marketStats: null,
  };
}


/** Markets.html `listings` (12 cards). */
const LISTING_SEEDS: MarketsMockSeed[] = [
  {
    id: "listing-1",
    image: "",
    ...gradeParts("PSA 10"),
    pop: parsePop("20.0k"),
    listed: 2,
    title: "Mega Dream ex · Pikachu Special Art Rare",
    set: "M2A Japanese · 234/193 SAR",
    priceUsd: 4312,
    changePct: 793.8,
    changeWindow: "180d",
    categoryHint: "pokemon",
    hoursAgo: 2,
  },
  {
    id: "listing-2",
    image: "",
    ...gradeParts("PSA 10"),
    pop: parsePop("3"),
    listed: 3,
    title: "2024 POKEMON SV DESTINED RIVALS #233 NIDOKING EX STELLAR RARE",
    set: "SV Destined Rivals · 233/182",
    priceUsd: 58_000,
    changePct: 138,
    changeWindow: "365d",
    categoryHint: "pokemon",
    hoursAgo: 4,
  },
  {
    id: "listing-3",
    image: MOCK_COLLECTR_CHARIZARD_EX_151_199,
    ...gradeParts("PSA 10"),
    pop: parsePop("27.7k"),
    listed: 1,
    title: "2023 POKEMON MEW EN-151 #199 CHARIZARD EX SPECIAL ILLUSTRATION RARE",
    set: "151 EN · 199/165",
    priceUsd: 1500,
    changePct: 118.4,
    changeWindow: "365d",
    categoryHint: "pokemon",
    hoursAgo: 6,
  },
  {
    id: "listing-4",
    image: "",
    ...gradeParts("BGS 9.5"),
    pop: parsePop("42"),
    listed: 1,
    title: "Luka Dončić Blue Ice",
    set: "2018 Prizm · #280",
    priceUsd: 19_154,
    changePct: 19.0,
    changeWindow: "365d",
    categoryHint: "nba",
    hoursAgo: 8,
  },
  {
    id: "listing-5",
    image: "",
    ...gradeParts("PSA 10"),
    pop: parsePop("16"),
    listed: 1,
    title: "2003 UPPER DECK ULTIMATE COLLECTION #127 LEBRON JAMES ROOKIE AUTO",
    set: "2003 Ultimate Collection · #127",
    priceUsd: 65_000,
    changePct: 12.8,
    changeWindow: "365d",
    categoryHint: "nba",
    hoursAgo: 10,
  },
  {
    id: "listing-6",
    image: "",
    ...gradeParts("PSA 10"),
    pop: parsePop("9,389"),
    listed: 1,
    title: "Pikachu ex · Surging Sparks",
    set: "SSP EN · 238/191",
    priceUsd: 1136,
    changePct: 47.5,
    changeWindow: "365d",
    categoryHint: "pokemon",
    hoursAgo: 2,
  },
  {
    id: "listing-7",
    image: "",
    ...gradeParts("PSA 10"),
    pop: parsePop("3"),
    listed: 1,
    title: "2024 POKEMON SV DESTINED RIVALS #233 NIDOKING EX STELLAR RARE",
    set: "SV Destined Rivals · 233/182",
    priceUsd: 57_400,
    changePct: null,
    categoryHint: "pokemon",
    hoursAgo: 12,
    customSub: { label: "POP 3", period: "scarce", tone: "accent" },
  },
  {
    id: "listing-8",
    image: MOCK_COLLECTR_CHARIZARD_EX_151_199,
    ...gradeParts("PSA 9"),
    pop: parsePop("31.2k"),
    listed: 4,
    title: "2023 POKEMON MEW EN-151 #199 CHARIZARD EX SPECIAL ILLUSTRATION RARE",
    set: "151 EN · 199/165",
    priceUsd: 880,
    changePct: -3.1,
    changeWindow: "365d",
    categoryHint: "pokemon",
    hoursAgo: 14,
  },
  {
    id: "listing-9",
    image: "",
    ...gradeParts("PSA 10"),
    pop: parsePop("61"),
    listed: 2,
    title: "Luka Dončić Silver Prizm",
    set: "2018 Prizm · #280",
    priceUsd: 22_500,
    changePct: 24.0,
    changeWindow: "365d",
    categoryHint: "nba",
    hoursAgo: 6,
  },
  {
    id: "listing-10",
    image: "",
    ...gradeParts("BGS 9.5"),
    pop: parsePop("18.4k"),
    listed: 3,
    title: "Mega Dream ex · Pikachu SAR",
    set: "M2A Japanese · 234/193 SAR",
    priceUsd: 3990,
    changePct: 610,
    changeWindow: "365d",
    categoryHint: "pokemon",
    hoursAgo: 16,
  },
  {
    id: "listing-11",
    image: "",
    ...gradeParts("BGS 9"),
    pop: parsePop("22"),
    listed: 1,
    title: "LeBron James Rookie Patch Auto",
    set: "2003 Ultimate · #127",
    priceUsd: 71_200,
    changePct: 9.4,
    changeWindow: "365d",
    categoryHint: "nba",
    hoursAgo: 18,
  },
  {
    id: "listing-12",
    image: "",
    ...gradeParts("PSA 10"),
    pop: parsePop("9,120"),
    listed: 5,
    title: "Pikachu ex · Surging Sparks",
    set: "SSP EN · 238/191",
    priceUsd: 1205,
    changePct: 52.0,
    changeWindow: "365d",
    categoryHint: "pokemon",
    hoursAgo: 9,
  },
];

export const MARKETS_MOCK_COLLECTIONS: MarketplaceCollectionSummary[] =
  LISTING_SEEDS.map(toCollection);

export const MARKETS_MOCK_SNAPSHOT_BY_KEY: Map<string, CollectionListMarketSnapshot> = (() => {
  const map = new Map<string, CollectionListMarketSnapshot>();
  for (const seed of LISTING_SEEDS) {
    const snap = toSnapshot(seed);
    map.set(snap.collectionKey.toLowerCase(), snap);
  }
  return map;
})();

export const MARKETS_MOCK_CUSTOM_SUB_BY_KEY: Map<string, HomeMockCardSub> = (() => {
  const map = new Map<string, HomeMockCardSub>();
  for (const seed of LISTING_SEEDS) {
    if (!seed.customSub) continue;
    map.set(`${MARKETS_MOCK_KEY_PREFIX}${seed.id}`.toLowerCase(), seed.customSub);
  }
  return map;
})();

export function shouldUseMarketsMockCards(realCollectionCount: number): boolean {
  const env = process.env.NEXT_PUBLIC_MARKETS_FORCE_MOCK_CARDS;
  if (env === "0") return realCollectionCount === 0;
  if (env === "1") return true;
  if (MARKETS_FORCE_MOCK_CARDS) return true;
  return realCollectionCount === 0;
}

export function marketsMockChangePeriodLabel(
  window: CollectionListMarketSnapshot["marketChangeWindow"] | undefined,
): string | undefined {
  if (window === "365d") return "1Y";
  if (window === "180d") return "180d";
  if (window === "90d") return "90d";
  if (window === "30d") return "30d";
  if (window === "7d") return "7d";
  return undefined;
}
