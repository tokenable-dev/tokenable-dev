import type { MarketIndexSummaryRow } from "@/lib/core";

export type MarketIndexCard = {
  title: string;
  valueUsd: number;
  change7dPct: number;
  change30dPct: number;
  change90dPct: number;
  gameId: string;
  change180dPct?: number;
  change365dPct: number;
  rawChange90dPct?: number;
  rawChange30dPct?: number;
};

type SlotDef = {
  title: string;
  slotKey: "pokemon" | "mlb" | "nfl" | "nba";
  test: (g: MarketIndexSummaryRow) => boolean;
};

function optNum(n: unknown): number | undefined {
  if (n === undefined || n === null) return undefined;
  const x = Number(n);
  return Number.isFinite(x) ? x : undefined;
}

function isRenderableSlotCard(g: MarketIndexSummaryRow): boolean {
  const v = Number(g.game_value_usd);
  const y = optNum(g.game_value_change_365d_pct);
  return Number.isFinite(v) && v > 0 && y !== undefined;
}

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

function isNonSportGame(g: MarketIndexSummaryRow): boolean {
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

function toCard(g: MarketIndexSummaryRow, title: string): MarketIndexCard {
  const y = optNum(g.game_value_change_365d_pct);
  if (y === undefined) {
    throw new Error("toCard: expected game_value_change_365d_pct (call only after isRenderableSlotCard)");
  }
  const r7 = optNum(g.game_value_change_7d_pct) ?? 0;
  const r30 = optNum(g.game_value_change_30d_pct);
  const r90 = optNum(g.game_value_change_90d_pct);
  const r30f = r30 ?? r7;
  const r90f = r90 ?? r30 ?? r7;
  return {
    title,
    valueUsd: Number(g.game_value_usd) || 0,
    change7dPct: r7,
    change30dPct: r30f,
    change90dPct: r90f,
    gameId: g.id,
    change180dPct: optNum(g.game_value_change_180d_pct),
    change365dPct: y,
    rawChange90dPct: optNum(g.game_value_change_90d_pct),
    rawChange30dPct: optNum(g.game_value_change_30d_pct),
  };
}

/** Dashboard slots that have a positive basket value and a real 365d % from the API. */
export function buildMarketIndexCards(games: MarketIndexSummaryRow[]): MarketIndexCard[] {
  if (!games.length) return [];

  const out: MarketIndexCard[] = [];
  const pushSlot = (row: MarketIndexSummaryRow | undefined, title: string) => {
    if (row && isRenderableSlotCard(row)) out.push(toCard(row, title));
  };

  const pokemonSlot = SLOTS[0]!;
  const candidates = games.filter((x) => pokemonSlot.test(x));
  candidates.sort((a, b) => {
    const pa = a.id.toLowerCase() === "pokemon" ? 0 : 1;
    const pb = b.id.toLowerCase() === "pokemon" ? 0 : 1;
    return pa - pb;
  });
  pushSlot(candidates.find(isRenderableSlotCard), pokemonSlot.title);

  const mlb =
    games.find((x) => x.id.toLowerCase() === "mlb") ?? games.find((x) => SLOTS[1]!.test(x));
  const nfl =
    games.find((x) => x.id.toLowerCase() === "nfl") ?? games.find((x) => SLOTS[2]!.test(x));
  const nba =
    games.find((x) => x.id.toLowerCase() === "nba") ?? games.find((x) => SLOTS[3]!.test(x));

  pushSlot(mlb, SLOTS[1]!.title);
  pushSlot(nfl, SLOTS[2]!.title);
  pushSlot(nba, SLOTS[3]!.title);

  return out;
}
