import type { CollectionUsdPoint } from "@/lib/core";
import { CHART_DAY_SEC, CHART_HOUR_SEC } from "./constants";

/** Expand interval when a chart would otherwise paint too many grid lines. */
function expandUsdInterval(interval: number): number {
  if (interval < 0.25) return 0.25;
  if (interval === 0.25) return 0.5;
  if (interval === 0.5) return 1;
  if (interval === 1) return 2;
  if (interval === 2) return 5;
  if (interval === 5) return 10;
  if (interval === 10) return 20;
  if (interval === 20) return 50;
  if (interval === 50) return 100;
  if (interval === 100) return 200;
  if (interval === 200) return 500;
  if (interval === 500) return 1000;
  if (interval === 1000) return 2000;
  if (interval === 2000) return 5000;
  if (interval === 5000) return 10_000;
  if (interval === 10_000) return 20_000;
  if (interval === 20_000) return 50_000;
  if (interval === 50_000) return 100_000;
  if (interval === 100_000) return 200_000;
  if (interval === 200_000) return 500_000;
  if (interval === 500_000) return 1_000_000;
  return interval * 2;
}

/**
 * Prefer readable USD steps across cheap → expensive cards:
 * - ≤ ~$2 → $0.25
 * - ≤ ~$5 → $0.50
 * - ≤ ~$15 → $1   (e.g. ~$9 cards → 0…10 axis, not 0…100)
 * - ≤ ~$40 → $5
 * - ≤ ~$100 → $10
 * - ≤ ~$1k → $100
 * - ≤ ~$12k → $1k
 * - ≤ ~$120k → $10k
 * - else → $100k / $1M
 */
function pickUsdInterval(rawMax: number, span: number): number {
  const ref = Math.max(Math.abs(rawMax), span);
  if (ref <= 2) return 0.25;
  if (ref <= 5) return 0.5;
  if (ref <= 15) return 1;
  if (ref <= 40) return 5;
  if (ref <= 100) return 10;
  if (ref <= 1000) return 100;
  if (ref <= 12_000) return 1000;
  if (ref <= 120_000) return 10_000;
  if (ref <= 1_200_000) return 100_000;
  return 1_000_000;
}

function snapDown(v: number, interval: number): number {
  return Math.floor((v + 1e-9) / interval) * interval;
}

function snapUp(v: number, interval: number): number {
  return Math.ceil((v - 1e-9) / interval) * interval;
}

/**
 * Shared price-axis scale for collection + portfolio charts.
 * `targetTicks` is a soft cap used only to expand the step when too dense.
 */
export function niceScale(
  rawMin: number,
  rawMax: number,
  targetTicks = 12,
): { min: number; max: number; interval: number } {
  if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax)) {
    return { min: 0, max: 1000, interval: 100 };
  }
  let lo = rawMin;
  let hi = rawMax;
  if (hi < lo) [lo, hi] = [hi, lo];
  if (hi === lo) {
    if (hi === 0) return { min: 0, max: 1000, interval: 100 };
    lo = Math.max(0, hi * 0.9);
    hi = hi * 1.1;
  }

  const span = hi - lo;
  let interval = pickUsdInterval(hi, span);
  const maxTickCount = Math.max(6, Math.min(14, Math.floor(targetTicks) || 12));

  let min = Math.max(0, snapDown(lo, interval));
  let max = snapUp(hi, interval);
  if (max <= min) max = min + interval;

  while ((max - min) / interval > maxTickCount) {
    interval = expandUsdInterval(interval);
    min = Math.max(0, snapDown(lo, interval));
    max = snapUp(hi, interval);
    if (max <= min) max = min + interval;
  }

  return { min, max, interval };
}

/** Build inclusive tick values for SVG charts (ECharts uses min/max/interval directly). */
export function ticksFromScale(min: number, max: number, interval: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(interval) || interval <= 0) {
    return [0, 1];
  }
  const ticks: number[] = [];
  const hi = max + interval * 0.001;
  for (let i = 0; i < 64; i++) {
    const v = min + i * interval;
    if (v > hi) break;
    ticks.push(Number(v.toFixed(6)));
  }
  return ticks.length > 0 ? ticks : [min, max];
}

/** 1y collection chart — from $0 with steps that fit the price magnitude. */
export function yearViewPriceScale(
  rawMin: number,
  rawMax: number,
): { min: number; max: number; interval: number } {
  if (!Number.isFinite(rawMax) || rawMax <= 0) {
    return { min: 0, max: 1000, interval: 100 };
  }
  /* Cheap cards need a little more headroom so the line isn't glued to the top. */
  const pad = rawMax <= 50 ? 1.15 : 1.06;
  const paddedMax = rawMax * pad;
  void rawMin;
  return niceScale(0, paddedMax, 12);
}

export function computeSmartTimeDomain(
  plat: CollectionUsdPoint[],
  nowSec: number,
  wideWindowSec: number,
): { tMin: number; tMax: number } {
  if (plat.length === 0) return { tMin: nowSec - 7 * CHART_DAY_SEC, tMax: nowSec };

  const ts = plat.map((p) => p.t);
  const dataTMin = Math.min(...ts);
  const dataTMax = Math.max(...ts);
  const dataSpan = Math.max(dataTMax - dataTMin, 1);
  const windowLo = nowSec - wideWindowSec;
  const windowSpan = Math.max(nowSec - windowLo, CHART_DAY_SEC);

  if (dataSpan < 0.14 * windowSpan) {
    const pad = Math.max(
      2 * CHART_HOUR_SEC,
      Math.min(3 * CHART_DAY_SEC, Math.max(dataSpan * 0.12, 4 * CHART_HOUR_SEC)),
    );
    let lo = dataTMin - pad;
    let hi = Math.max(dataTMax + pad, nowSec + 2 * CHART_HOUR_SEC);
    const minDur = plat.length <= 2 ? 4 * CHART_DAY_SEC : 36 * CHART_HOUR_SEC;
    if (hi - lo < minDur) {
      const c = (lo + hi) / 2;
      lo = c - minDur / 2;
      hi = c + minDur / 2;
    }
    return { tMin: lo, tMax: Math.max(hi, nowSec + CHART_HOUR_SEC) };
  }

  const padWide = Math.max(CHART_DAY_SEC, dataSpan * 0.02);
  return {
    tMin: Math.min(dataTMin - padWide, windowLo),
    tMax: Math.max(dataTMax + padWide, nowSec),
  };
}
