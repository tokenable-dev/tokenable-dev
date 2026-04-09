import type { JustTcgPriceHistoryPoint } from "@/lib/api";

const DAY_SEC = 86400;

/**
 * Builds a 4-point series of implied total market value (USD) from current
 * `game_value_usd` and JustTCG aggregate % changes (7d / 30d / 90d windows).
 * V_past ≈ V_now / (1 + r/100). Same data as the headline stats — usable when
 * per-card `priceHistory` is missing (common on list/search endpoints).
 */
export function buildImpliedGameValueTrend(params: {
  valueUsd: number;
  change7dPct: number;
  change30dPct: number;
  change90dPct: number;
}): JustTcgPriceHistoryPoint[] {
  const vNow = params.valueUsd;
  if (!Number.isFinite(vNow) || vNow <= 0) return [];

  const r7 = safePct(params.change7dPct);
  const r30 = safePct(params.change30dPct);
  const r90 = safePct(params.change90dPct);

  const now = Math.floor(Date.now() / 1000);
  const v7 = vNow / (1 + r7 / 100);
  const v30 = vNow / (1 + r30 / 100);
  const v90 = vNow / (1 + r90 / 100);

  return [
    { p: v90, t: now - 90 * DAY_SEC },
    { p: v30, t: now - 30 * DAY_SEC },
    { p: v7, t: now - 7 * DAY_SEC },
    { p: vNow, t: now },
  ];
}

function safePct(n: number): number {
  return Number.isFinite(n) ? n : 0;
}
