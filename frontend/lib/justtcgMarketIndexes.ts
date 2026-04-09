import type { JustTcgGameSummary } from "@/lib/api";

export type MarketIndexCard = {
  /** Card title (e.g. Pokemon Index or Magic: The Gathering Index) */
  title: string;
  valueUsd: number;
  change7dPct: number;
  change30dPct: number;
  change90dPct: number;
  gameId: string;
};

type SlotDef = {
  title: string;
  test: (g: JustTcgGameSummary) => boolean;
};

const SLOTS: SlotDef[] = [
  {
    title: "Pokemon Index",
    test: (g) => g.id === "pokemon",
  },
  {
    title: "Baseball Index",
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
    title: "NFL Index",
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
    title: "Basketball Index",
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
  return {
    title,
    valueUsd: Number(g.game_value_usd) || 0,
    change7dPct: r7,
    change30dPct: Number.isFinite(r30) ? r30 : r7,
    change90dPct: Number.isFinite(r90) ? r90 : Number.isFinite(r30) ? r30 : r7,
    gameId: g.id,
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
