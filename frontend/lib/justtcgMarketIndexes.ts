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
  /** Raw trailing 90d / 30d from API (for 180d-back estimates when 180d field is absent) */
  rawChange90dPct?: number;
  rawChange30dPct?: number;
};

type SlotDef = {
  title: string;
  test: (g: JustTcgGameSummary) => boolean;
};

function optNum(n: unknown): number | undefined {
  if (n === undefined || n === null) return undefined;
  const x = Number(n);
  return Number.isFinite(x) ? x : undefined;
}

const SLOTS: SlotDef[] = [
  {
    title: "🐻 Pokemon Index",
    test: (g) => g.id === "pokemon",
  },
  {
    title: "⚾ Baseball Index",
    test: (g) => {
      const id = g.id.toLowerCase();
      const name = g.name.toLowerCase();
      return (
        /\bmlb\b|baseball|topps.*baseball|bowman.*baseball/i.test(id) ||
        /\bmlb\b|baseball/i.test(name)
      );
    },
  },
  {
    title: "🏈 NFL Index",
    test: (g) => {
      const id = g.id.toLowerCase();
      const name = g.name.toLowerCase();
      return (
        /\bnfl\b|panini.*football|leaf.*football|topps.*football/i.test(id) ||
        /\bnfl\b|national football|american football(?!.*soccer)/i.test(name)
      );
    },
  },
  {
    title: "🏀 NBA Index",
    test: (g) => {
      const id = g.id.toLowerCase();
      const name = g.name.toLowerCase();
      return (
        /\bnba\b|basketball|panini.*nba/i.test(id) ||
        /\bnba\b|basketball/i.test(name)
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
    rawChange90dPct: optNum(g.game_value_change_90d_pct),
    rawChange30dPct: optNum(g.game_value_change_30d_pct),
  };
}

/**
 * Picks up to 4 market cards: preferred slots (Pokemon / sports) when present in JustTCG,
 * then fills with highest `game_value_usd` games not yet used.
 */
export function buildMarketIndexCards(games: JustTcgGameSummary[]): MarketIndexCard[] {
  if (!games.length) return [];

  const used = new Set<string>();
  const out: MarketIndexCard[] = [];

  for (const slot of SLOTS) {
    const g = games.find((x) => !used.has(x.id) && slot.test(x));
    if (g) {
      used.add(g.id);
      out.push(toCard(g, slot.title));
    }
  }

  const rest = [...games]
    .filter((g) => !used.has(g.id))
    .sort((a, b) => (b.game_value_usd ?? 0) - (a.game_value_usd ?? 0));

  while (out.length < 4 && rest.length) {
    const g = rest.shift()!;
    if (used.has(g.id)) continue;
    used.add(g.id);
    out.push(toCard(g, `${g.name} Index`));
  }

  return out.slice(0, 4);
}
