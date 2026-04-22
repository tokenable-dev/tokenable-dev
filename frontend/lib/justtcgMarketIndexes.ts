import type { JustTcgGameSummary } from "@/lib/api";

export type MarketIndexCard = {
  /** Card title (e.g. Pokemon Index or Magic: The Gathering Index) */
  title: string;
  valueUsd: number;
  change7dPct: number;
  change30dPct: number;
  change90dPct: number;
  gameId: string;
  /** JustTCG `game_value_change_180d_pct` when returned on the game row */
  change180dPct?: number;
  /** JustTCG `game_value_change_365d_pct` when returned on the game row */
  change365dPct?: number;
  /** Raw trailing 90d / 30d from API (for 180d-back estimates when 180d field is absent) */
  rawChange90dPct?: number;
  rawChange30dPct?: number;
  /** Pokemon missing from `GET /price/games` */
  synthetic?: boolean;
  /** MLB / NFL / NBA columns: placeholder aggregates (UI same as live cards). */
  demoMock?: boolean;
};

type SlotDef = {
  title: string;
  slotKey: "pokemon" | "mlb" | "nfl" | "nba";
  test: (g: JustTcgGameSummary) => boolean;
};

function optNum(n: unknown): number | undefined {
  if (n === undefined || n === null) return undefined;
  const x = Number(n);
  return Number.isFinite(x) ? x : undefined;
}

/** Exclude obvious non-sport product lines when guessing “sport” rows (rare on JustTCG). */
const NON_SPORT_ID = new RegExp(
  [
    "pokemon",
    "yugioh",
    "yu-gi",
    "mtg",
    "magic",
    "lorcana",
    "one-piece",
    "digimon",
    "flesh-and-blood",
    "disney",
    "gundam",
    "hololive",
    "grand-archive",
    "dragon-ball",
    "sorcery",
    "star-wars",
    "riftbound",
    "union-arena",
    "uniVersus",
    "versusc",
  ].join("|"),
  "i",
);

function isNonSportGame(g: JustTcgGameSummary): boolean {
  const id = g.id.toLowerCase();
  const name = g.name.toLowerCase();
  return NON_SPORT_ID.test(id) || NON_SPORT_ID.test(name);
}

const SLOTS: SlotDef[] = [
  {
    title: "Pokemon Index",
    slotKey: "pokemon",
    test: (g) => {
      const id = g.id.toLowerCase();
      return id === "pokemon" || id === "pokemon-japan" || id.startsWith("pokemon-");
    },
  },
  {
    title: "MLB Index",
    slotKey: "mlb",
    test: (g) => {
      if (isNonSportGame(g)) return false;
      const id = g.id.toLowerCase();
      const name = g.name.toLowerCase();
      return (
        /\bmlb\b|baseball|bowman|topps.*(baseball|chrome|update|series)|leaf.*baseball/i.test(
          id,
        ) ||
        /\bmlb\b|baseball|\bbowman\b|\btopps\b.*baseball|\bpanini\b.*(prizm|select|optic|mosaic).*baseball/i.test(
          name,
        )
      );
    },
  },
  {
    title: "NFL Index",
    slotKey: "nfl",
    test: (g) => {
      if (isNonSportGame(g)) return false;
      const id = g.id.toLowerCase();
      const name = g.name.toLowerCase();
      return (
        /\bnfl\b|football|panini.*(nfl|football)|leaf.*football|topps.*(football|chrome.*nfl)/i.test(
          id,
        ) ||
        /\bnfl\b|national football|american football(?!.*soccer)|\bcontenders\b|\bprizm\b.*nfl/i.test(
          name,
        )
      );
    },
  },
  {
    title: "NBA Index",
    slotKey: "nba",
    test: (g) => {
      if (isNonSportGame(g)) return false;
      const id = g.id.toLowerCase();
      const name = g.name.toLowerCase();
      return (
        /\bnba\b|basketball|panini.*(nba|basketball)|hoops|mosaic.*nba|donruss.*nba/i.test(id) ||
        /\bnba\b|basketball|\bprizm\b.*(nba|basketball)|\boptic\b.*nba/i.test(name)
      );
    },
  },
];

function toCard(g: JustTcgGameSummary, title: string): MarketIndexCard {
  const r7 = Number(g.game_value_change_7d_pct) || 0;
  const r30 = Number(g.game_value_change_30d_pct);
  const r90 = Number(g.game_value_change_90d_pct);
  const r30f = Number.isFinite(r30) ? r30 : r7;
  const r90f = Number.isFinite(r90) ? r90 : Number.isFinite(r30) ? r30 : r7;
  return {
    title,
    valueUsd: Number(g.game_value_usd) || 0,
    change7dPct: r7,
    change30dPct: r30f,
    change90dPct: r90f,
    gameId: g.id,
    change180dPct: optNum(g.game_value_change_180d_pct),
    change365dPct: optNum(g.game_value_change_365d_pct),
    rawChange90dPct: optNum(g.game_value_change_90d_pct),
    rawChange30dPct: optNum(g.game_value_change_30d_pct),
    synthetic: false,
    demoMock: false,
  };
}

function syntheticPokemonCard(slot: SlotDef): MarketIndexCard {
  return {
    title: slot.title,
    valueUsd: 0,
    change7dPct: 0,
    change30dPct: 0,
    change90dPct: 0,
    gameId: "pokemon-unavailable",
    synthetic: true,
    demoMock: false,
  };
}

/** Placeholder totals / returns for landing MLB · NFL · NBA (swap for live API later). */
const MOCK_SPORT_INDEX: Record<
  "mlb" | "nfl" | "nba",
  Pick<
    MarketIndexCard,
    | "valueUsd"
    | "change7dPct"
    | "change30dPct"
    | "change90dPct"
    | "change180dPct"
    | "change365dPct"
    | "rawChange90dPct"
    | "rawChange30dPct"
  >
> = {
  mlb: {
    valueUsd: 1_950_000_000,
    change7dPct: 0.42,
    change30dPct: 1.05,
    change90dPct: 2.35,
    change180dPct: 3.9,
    change365dPct: 6.15,
    rawChange90dPct: 2.35,
    rawChange30dPct: 1.05,
  },
  nfl: {
    valueUsd: 2_180_000_000,
    change7dPct: -0.18,
    change30dPct: 0.72,
    change90dPct: 1.88,
    change180dPct: 3.1,
    change365dPct: 5.4,
    rawChange90dPct: 1.88,
    rawChange30dPct: 0.72,
  },
  nba: {
    valueUsd: 1_720_000_000,
    change7dPct: 0.61,
    change30dPct: 1.42,
    change90dPct: 2.95,
    change180dPct: 4.25,
    change365dPct: 7.05,
    rawChange90dPct: 2.95,
    rawChange30dPct: 1.42,
  },
};

function demoSportIndexCard(slotKey: "mlb" | "nfl" | "nba", title: string): MarketIndexCard {
  const m = MOCK_SPORT_INDEX[slotKey];
  return {
    title,
    gameId: `${slotKey}-demo`,
    ...m,
    synthetic: false,
    demoMock: true,
  };
}

/** Four cards: Pokemon from `GET /price/games`; MLB / NFL / NBA use fixed placeholder aggregates. */
export function buildMarketIndexCards(games: JustTcgGameSummary[]): MarketIndexCard[] {
  const pokemonSlot = SLOTS[0]!;
  const candidates = games.filter((x) => pokemonSlot.test(x));
  candidates.sort((a, b) => {
    const pa = a.id.toLowerCase() === "pokemon" ? 0 : 1;
    const pb = b.id.toLowerCase() === "pokemon" ? 0 : 1;
    return pa - pb;
  });
  const g = candidates[0];
  const pokemonCard: MarketIndexCard = g
    ? toCard(g, pokemonSlot.title)
    : syntheticPokemonCard(pokemonSlot);

  const sportCards: MarketIndexCard[] = [
    demoSportIndexCard("mlb", SLOTS[1]!.title),
    demoSportIndexCard("nfl", SLOTS[2]!.title),
    demoSportIndexCard("nba", SLOTS[3]!.title),
  ];

  return [pokemonCard, ...sportCards];
}
