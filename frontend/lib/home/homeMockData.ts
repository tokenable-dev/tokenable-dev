import type {
  CollectionListMarketSnapshot,
  MarketplaceCollectionSummary,
} from "@/lib/core";
import { enrichDesignMockComponents } from "@/lib/marketplace/enrichDesignMockComponents";
import { MOCK_COLLECTR_CHARIZARD_EX_151_199 } from "@/lib/home/withMockCoverImages";

/**
 * Design parity with `Tokenable-with design system/index.html` `renderVals()`.
 * Real marketplace query path stays intact — flip to `false` to prefer live catalog
 * (mocks only when the catalog is empty).
 */
export const HOME_FORCE_MOCK_CARDS = true;

export const HOME_MOCK_KEY_PREFIX = "mock:home:";

export function isHomeMockCollectionKey(collectionKey: string): boolean {
  return collectionKey.toLowerCase().startsWith(HOME_MOCK_KEY_PREFIX);
}

export type HomeMockCardSub = {
  label: string;
  period?: string;
  tone: "up" | "down" | "muted" | "accent";
};

type MockCardSeed = {
  id: string;
  image: string;
  gradeCompany: string;
  gradeScore: string;
  pop: number;
  listed: number;
  title: string;
  set: string;
  priceUsd: number;
  /** Reference % change for movers / ticker (null = vaulted-style muted sub). */
  changePct: number | null;
  changeWindow?: CollectionListMarketSnapshot["marketChangeWindow"];
  vaultedSub?: HomeMockCardSub;
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

function toCollection(seed: MockCardSeed): MarketplaceCollectionSummary {
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
  });
  return {
    collectionKey: `${HOME_MOCK_KEY_PREFIX}${seed.id}`,
    displayLabel: seed.title,
    queryUsed: null,
    components,
    createdAt: hoursAgoIso(seed.hoursAgo ?? 24),
    activeListingCount: seed.listed,
    coverImageUrl: seed.image,
    displayImageUrl: seed.image,
  };
}

function toSnapshot(seed: MockCardSeed): CollectionListMarketSnapshot {
  const key = `${HOME_MOCK_KEY_PREFIX}${seed.id}`;
  return {
    collectionKey: key,
    categoryLabel: null,
    marketChangePct: seed.changePct,
    marketChangeWindow: seed.changeWindow,
    marketChangeIsFullYear: seed.changeWindow === "365d",
    gradePrices: {
      psa10: seed.gradeScore === "10" ? seed.priceUsd : null,
      psa9: seed.gradeScore === "9" || seed.gradeScore === "9.5" ? seed.priceUsd : null,
      raw: null,
    },
    sparklineUsd: buildSparkline(seed.priceUsd, seed.changePct),
    marketStats: null,
  };
}


/** index.html Top movers */
const MOVER_SEEDS: MockCardSeed[] = [
  {
    id: "mover-pikachu-ex-sar",
    image: "",
    ...gradeParts("PSA 10"),
    pop: parsePop("20.0k"),
    listed: 2,
    title: "Mega Dream ex · Pikachu Special Art Rare",
    set: "M2A Japanese · 234/193 SAR",
    priceUsd: 4312,
    changePct: 793.8,
    changeWindow: "180d",
  },
  {
    id: "mover-nidoking",
    image: "",
    ...gradeParts("PSA 10"),
    pop: parsePop("3"),
    listed: 3,
    title: "2024 POKEMON SV DESTINED RIVALS #233 NIDOKING EX STELLAR RARE",
    set: "SV Destined Rivals · 233/182",
    priceUsd: 58_000,
    changePct: 138,
    changeWindow: "365d",
  },
  {
    id: "mover-charizard-151",
    image: MOCK_COLLECTR_CHARIZARD_EX_151_199,
    ...gradeParts("PSA 10"),
    pop: parsePop("27.7k"),
    listed: 1,
    title: "2023 POKEMON MEW EN-151 #199 CHARIZARD EX SPECIAL ILLUSTRATION RARE",
    set: "151 EN · 199/165",
    priceUsd: 1500,
    changePct: 118.4,
    changeWindow: "365d",
  },
  {
    id: "mover-luka",
    image: "",
    ...gradeParts("BGS 9.5"),
    pop: parsePop("42"),
    listed: 1,
    title: "Luka Dončić Blue Ice",
    set: "2018 Prizm · #280",
    priceUsd: 19_154,
    changePct: 19.0,
    changeWindow: "365d",
  },
  {
    id: "mover-pikachu-ssp",
    image: "",
    ...gradeParts("PSA 10"),
    pop: parsePop("9,389"),
    listed: 5,
    title: "Pikachu ex · Surging Sparks",
    set: "SSP EN · 238/191",
    priceUsd: 1136,
    changePct: 47.5,
    changeWindow: "180d",
  },
  {
    id: "mover-lebron-chrome",
    image: "",
    ...gradeParts("BGS 9.5"),
    pop: parsePop("42"),
    listed: 3,
    title: "2003 TOPPS CHROME #111 LEBRON JAMES ROOKIE REFRACTOR",
    set: "2003 Topps Chrome · #111",
    priceUsd: 58_000,
    changePct: 87.5,
    changeWindow: "365d",
  },
  {
    id: "mover-charizard-1st",
    image: "",
    ...gradeParts("PSA 9"),
    pop: parsePop("666"),
    listed: 4,
    title: "Charizard 1st Edition Base Set",
    set: "1999 Base Set · #4",
    priceUsd: 420_000,
    changePct: 138,
    changeWindow: "365d",
  },
];

/** index.html Just vaulted */
const VAULTED_SEEDS: MockCardSeed[] = [
  {
    id: "vaulted-lebron-auto",
    image: "",
    ...gradeParts("PSA 10"),
    pop: parsePop("16"),
    listed: 1,
    title: "2003 UPPER DECK ULTIMATE COLLECTION #127 LEBRON JAMES ROOKIE AUTO",
    set: "2003 Ultimate Collection · #127",
    priceUsd: 65_000,
    changePct: null,
    hoursAgo: 1,
    vaultedSub: { label: "Just listed", tone: "muted" },
  },
  {
    id: "vaulted-pikachu-ssp",
    image: "",
    ...gradeParts("PSA 10"),
    pop: parsePop("9,389"),
    listed: 1,
    title: "Pikachu ex · Surging Sparks",
    set: "SSP EN · 238/191",
    priceUsd: 1136,
    changePct: null,
    hoursAgo: 3,
    vaultedSub: { label: "Just listed", tone: "muted" },
  },
  {
    id: "vaulted-nidoking",
    image: "",
    ...gradeParts("PSA 10"),
    pop: parsePop("3"),
    listed: 1,
    title: "2024 POKEMON SV DESTINED RIVALS #233 NIDOKING EX STELLAR RARE",
    set: "SV Destined Rivals · 233/182",
    priceUsd: 58_000,
    changePct: null,
    hoursAgo: 5,
    vaultedSub: { label: "POP 3 · scarce", tone: "accent" },
  },
  {
    id: "vaulted-luka",
    image: "",
    ...gradeParts("BGS 9.5"),
    pop: parsePop("42"),
    listed: 1,
    title: "Luka Dončić Blue Ice",
    set: "2018 Prizm · #280",
    priceUsd: 19_154,
    changePct: null,
    hoursAgo: 8,
    vaultedSub: { label: "Just listed", tone: "muted" },
  },
  {
    id: "vaulted-pikachu-ex",
    image: "",
    ...gradeParts("PSA 10"),
    pop: parsePop("20.0k"),
    listed: 1,
    title: "Mega Dream ex · Pikachu SAR",
    set: "M2A Japanese · 234/193",
    priceUsd: 4312,
    changePct: null,
    hoursAgo: 12,
    vaultedSub: { label: "Vaulted 12h", tone: "muted" },
  },
  {
    id: "vaulted-charizard-151",
    image: MOCK_COLLECTR_CHARIZARD_EX_151_199,
    ...gradeParts("PSA 10"),
    pop: parsePop("27.7k"),
    listed: 1,
    title: "Charizard ex · 151 SAR",
    set: "151 EN · 199/165",
    priceUsd: 1500,
    changePct: null,
    hoursAgo: 16,
    vaultedSub: { label: "Vaulted 16h", tone: "muted" },
  },
  {
    id: "vaulted-lebron-chrome",
    image: "",
    ...gradeParts("BGS 9.5"),
    pop: parsePop("42"),
    listed: 1,
    title: "LeBron James Chrome RC",
    set: "2003 Topps Chrome · #111",
    priceUsd: 58_000,
    changePct: null,
    hoursAgo: 20,
    vaultedSub: { label: "Just listed", tone: "muted" },
  },
];

/**
 * Indices 1Y ticker mock strip.
 * Keep this list long enough that one marquee cycle (before CSS duplicates the
 * row for seamless loop) is wider than a typical ultrawide viewport — otherwise
 * the same names appear twice on screen at once.
 */
export const HOME_MOCK_TICKER_ITEMS: {
  name: string;
  changePct: number;
}[] = [
  { name: "Pikachu ex SAR", changePct: 793 },
  { name: "Nidoking ex", changePct: 138 },
  { name: "Charizard ex", changePct: 118 },
  { name: "Pikachu ex SSP", changePct: 47 },
  { name: "Umbreon VMAX", changePct: 86 },
  { name: "Gengar VMAX", changePct: 62 },
  { name: "Mewtwo GX", changePct: 41 },
  { name: "Rayquaza VMAX", changePct: 55 },
  { name: "Lugia V ALT", changePct: 73 },
  { name: "Moonbreon", changePct: 124 },
  { name: "Blastoise ex", changePct: 38 },
  { name: "Venusaur ex", changePct: 29 },
  { name: "Luka Doncic", changePct: 19 },
  { name: "LeBron Auto", changePct: 13 },
  { name: "Wembanyama RC", changePct: -4 },
  { name: "Shohei Ohtani", changePct: 9 },
  { name: "Jordan Fleer", changePct: 22 },
  { name: "Kobe Chromes", changePct: 17 },
  { name: "Curry Prizm", changePct: 11 },
  { name: "Giannis Optic", changePct: 8 },
  { name: "Ja Morant RC", changePct: -6 },
  { name: "Lamelo RC", changePct: -9 },
  { name: "Tatum Select", changePct: 14 },
  { name: "Edwards Prizm", changePct: 16 },
  { name: "Judge Rookie", changePct: 21 },
  { name: "Acuna Chrome", changePct: 12 },
  { name: "Trout Update", changePct: 7 },
  { name: "Soto Refractor", changePct: 10 },
  { name: "Harper Auto", changePct: 5 },
  { name: "Witt Jr RC", changePct: 18 },
  { name: "Mahomes Prizm", changePct: 15 },
  { name: "Burrow Optic", changePct: 6 },
  { name: "Allen Select", changePct: 9 },
  { name: "Jackson RC", changePct: 12 },
  { name: "Black Lotus", changePct: 34 },
  { name: "Mox Sapphire", changePct: 28 },
  { name: "Ancestral", changePct: 19 },
  { name: "Time Walk", changePct: 16 },
  { name: "Ragavan", changePct: -3 },
  { name: "Sheoldred", changePct: 11 },
  { name: "The One Ring", changePct: 24 },
  { name: "Sol Ring", changePct: 4 },
  { name: "Pikachu Illustrator", changePct: 210 },
  { name: "Charizard Base", changePct: 67 },
  { name: "Eevee Heroes", changePct: 33 },
  { name: "Lost Origin", changePct: 27 },
  { name: "Obsidian Flames", changePct: -2 },
  { name: "Paldea Evolved", changePct: 8 },
];

export const HOME_MOCK_TOP_MOVERS: MarketplaceCollectionSummary[] =
  MOVER_SEEDS.map(toCollection);

export const HOME_MOCK_JUST_VAULTED: MarketplaceCollectionSummary[] =
  VAULTED_SEEDS.map(toCollection);

export const HOME_MOCK_SNAPSHOT_BY_KEY: Map<string, CollectionListMarketSnapshot> = (() => {
  const map = new Map<string, CollectionListMarketSnapshot>();
  for (const seed of [...MOVER_SEEDS, ...VAULTED_SEEDS]) {
    const snap = toSnapshot(seed);
    map.set(snap.collectionKey.toLowerCase(), snap);
  }
  return map;
})();

export const HOME_MOCK_VAULTED_SUB_BY_KEY: Map<string, HomeMockCardSub> = (() => {
  const map = new Map<string, HomeMockCardSub>();
  for (const seed of VAULTED_SEEDS) {
    if (!seed.vaultedSub) continue;
    map.set(`${HOME_MOCK_KEY_PREFIX}${seed.id}`.toLowerCase(), seed.vaultedSub);
  }
  return map;
})();

export function shouldUseHomeMockCards(realCollectionCount: number): boolean {
  const env = process.env.NEXT_PUBLIC_HOME_FORCE_MOCK_CARDS;
  if (env === "0") return realCollectionCount === 0;
  if (env === "1") return true;
  if (HOME_FORCE_MOCK_CARDS) return true;
  return realCollectionCount === 0;
}

/** Window label for CollectibleCard period chip (HTML: 180d / 1Y). */
export function homeMockChangePeriodLabel(
  window: CollectionListMarketSnapshot["marketChangeWindow"] | undefined,
): string | undefined {
  if (window === "365d") return "1Y";
  if (window === "180d") return "180d";
  if (window === "90d") return "90d";
  if (window === "30d") return "30d";
  if (window === "7d") return "7d";
  return undefined;
}
