import type { Top100HistorySnapshot } from "@/lib/core/api/cardhedger";
import type { Top100Item } from "@/hooks/markets/usePokemonTop100";
import { parseTop100Price } from "./top100CardDisplay";

export type Top100DayChange = {
  yesterdayRank: number | null;
  yesterdayPrice: number | null;
  /** Positive = moved up (better rank). yesterdayRank - todayRank */
  rankDelta: number | null;
  priceDelta: number | null;
  priceDeltaPct: number | null;
  isNew: boolean;
};

export type Top100DayChangeResult = {
  available: boolean;
  compareDate: string | null;
  byCardId: Map<string, Top100DayChange>;
};

export function buildTop100DayChangeMap(
  todayItems: Top100Item[],
  snapshots: Top100HistorySnapshot[],
): Top100DayChangeResult {
  const byCardId = new Map<string, Top100DayChange>();

  if (snapshots.length < 2) {
    return { available: false, compareDate: null, byCardId };
  }

  const yesterday = snapshots[1];
  const yesterdayById = new Map<string, { rank: number; price: number | null }>();

  yesterday.cards.forEach((card, idx) => {
    yesterdayById.set(card.card_id, {
      rank: idx + 1,
      price: parseTop100Price(card.price),
    });
  });

  for (const item of todayItems) {
    const prev = yesterdayById.get(item.card_id);
    if (!prev) {
      byCardId.set(item.card_id, {
        yesterdayRank: null,
        yesterdayPrice: null,
        rankDelta: null,
        priceDelta: null,
        priceDeltaPct: null,
        isNew: true,
      });
      continue;
    }

    const rankDelta = prev.rank - item.rank;
    const priceDelta =
      item.priceNum != null && prev.price != null ? item.priceNum - prev.price : null;
    const priceDeltaPct =
      priceDelta != null && prev.price != null && prev.price > 0
        ? (priceDelta / prev.price) * 100
        : null;

    byCardId.set(item.card_id, {
      yesterdayRank: prev.rank,
      yesterdayPrice: prev.price,
      rankDelta,
      priceDelta,
      priceDeltaPct,
      isNew: false,
    });
  }

  return {
    available: true,
    compareDate: yesterday.snapshotDate,
    byCardId,
  };
}
