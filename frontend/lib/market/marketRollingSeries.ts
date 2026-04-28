import type { CollectionUsdPoint, MarketPriceBand } from "@/lib/core";

const DAY = 86400;

function blendRolling(
  ebay: MarketPriceBand | null,
  tcg: MarketPriceBand | null,
  keys: (keyof MarketPriceBand)[],
): number | null {
  const nums: number[] = [];
  for (const k of keys) {
    const ve = ebay?.[k];
    const vt = tcg?.[k];
    if (typeof ve === "number" && Number.isFinite(ve) && ve > 0) nums.push(ve);
    if (typeof vt === "number" && Number.isFinite(vt) && vt > 0) nums.push(vt);
  }
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function spotAvg(ebay: MarketPriceBand | null, tcg: MarketPriceBand | null): number | null {
  const ve = ebay?.avg;
  const vt = tcg?.avg;
  const nums: number[] = [];
  if (typeof ve === "number" && Number.isFinite(ve) && ve > 0) nums.push(ve);
  if (typeof vt === "number" && Number.isFinite(vt) && vt > 0) nums.push(vt);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function buildMarketRollingSnapshotSeries(
  ebay: MarketPriceBand | null,
  tcg: MarketPriceBand | null,
  nowSec: number,
): CollectionUsdPoint[] {
  const layers: { lookbackDays: number; value: () => number | null }[] = [
    { lookbackDays: 30, value: () => blendRolling(ebay, tcg, ["median30d", "avg30d"]) },
    { lookbackDays: 7, value: () => blendRolling(ebay, tcg, ["median7d", "avg7d"]) },
    { lookbackDays: 3, value: () => blendRolling(ebay, tcg, ["median3d"]) },
    { lookbackDays: 1, value: () => blendRolling(ebay, tcg, ["avg1d"]) },
    { lookbackDays: 0, value: () => spotAvg(ebay, tcg) },
  ];

  const out: CollectionUsdPoint[] = [];
  for (const L of layers) {
    const v = L.value();
    if (v == null || !Number.isFinite(v) || v <= 0) continue;
    const t = L.lookbackDays === 0 ? nowSec : nowSec - L.lookbackDays * DAY;
    out.push({ t, v });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

