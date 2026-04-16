import type { CollectionUsdPoint, PoketracePriceBand } from "@/lib/api";

const DAY = 86400;

/**
 * Blend eBay + TCGPlayer for the same rolling key (simple mean of available sources).
 */
function blendRolling(
  ebay: PoketracePriceBand | null,
  tcg: PoketracePriceBand | null,
  keys: (keyof PoketracePriceBand)[],
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

function spotAvg(ebay: PoketracePriceBand | null, tcg: PoketracePriceBand | null): number | null {
  const ve = ebay?.avg;
  const vt = tcg?.avg;
  const nums: number[] = [];
  if (typeof ve === "number" && Number.isFinite(ve) && ve > 0) nums.push(ve);
  if (typeof vt === "number" && Number.isFinite(vt) && vt > 0) nums.push(vt);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Builds a polyline from one API snapshot: each point is a different rolling window,
 * placed at t = now − lookbackDays (and “now” for spot). This shows **variation across
 * rollings**, not a true daily price path — label it in the UI.
 */
export function buildPoketraceRollingSnapshotSeries(
  ebay: PoketracePriceBand | null,
  tcg: PoketracePriceBand | null,
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
  const dedup: CollectionUsdPoint[] = [];
  for (const p of out) {
    if (dedup.length && dedup[dedup.length - 1].t === p.t) {
      dedup[dedup.length - 1] = p;
    } else {
      dedup.push(p);
    }
  }
  return dedup;
}

/** Longest horizontal span implied by the rolling snapshot (for x-axis width). */
export function rollingSnapshotMaxLookbackDays(pts: CollectionUsdPoint[], nowSec: number): number {
  if (pts.length === 0) return 30;
  let max = 0;
  for (const p of pts) {
    const d = Math.ceil((nowSec - p.t) / DAY);
    if (d > max) max = d;
  }
  return Math.min(Math.max(max, 7), 365);
}

function hashUint32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** [0,1) deterministic from seed + index — stable across re-renders */
function frac01(seed: number, i: number): number {
  const x = Math.sin(seed * 0.0001 + i * 97.329 + 12.9898) * 43758.5453123;
  return x - Math.floor(x);
}

/**
 * Illustrative daily NM line from a **single** anchor (e.g. blended 30d median from preview).
 * Not real sale-by-day history — avoids extra PokeTrace history/search calls and rate limits.
 */
export function buildSyntheticNmIllustratedSeries(opts: {
  anchorUsd: number;
  windowDays?: number;
  nowSec: number;
  /** Stable id (e.g. collection key + card id) so the curve shape is fixed per listing */
  seed: string;
}): CollectionUsdPoint[] {
  const { anchorUsd, nowSec, seed } = opts;
  const windowDays = Math.min(365, Math.max(14, Math.floor(opts.windowDays ?? 90)));
  if (!(anchorUsd > 0) || !Number.isFinite(anchorUsd)) return [];

  const h = hashUint32(seed);
  const phase1 = (h % 6283) / 1000;
  const phase2 = ((h >> 8) % 6283) / 1000;
  const amp1 = 0.038;
  const amp2 = 0.022;
  const ampMicro = 0.012;

  const out: CollectionUsdPoint[] = [];
  const denom = Math.max(windowDays - 1, 1);

  for (let i = 0; i < windowDays; i++) {
    const t = nowSec - (windowDays - 1 - i) * DAY;
    const u = i / denom;
    const wave =
      amp1 * Math.sin(u * Math.PI * 2 * 1.15 + phase1) +
      amp2 * Math.sin(u * Math.PI * 2 * 3.2 + phase2);
    const micro = ampMicro * (frac01(h, i) - 0.5) * 2;
    let v = anchorUsd * (1 + wave + micro);
    v = Math.max(v, anchorUsd * 0.93);
    v = Math.min(v, anchorUsd * 1.07);
    out.push({ t, v: Math.round(v * 100) / 100 });
  }
  return out;
}
