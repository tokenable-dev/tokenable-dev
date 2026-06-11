import type { CollectionUsdPoint } from "@/lib/core";
import { CHART_DAY_SEC, CHART_HOUR_SEC } from "./constants";

export function niceScale(
  rawMin: number,
  rawMax: number,
  targetTicks = 5,
): { min: number; max: number; interval: number } {
  const range = rawMax - rawMin;
  if (range === 0 || !Number.isFinite(range)) return { min: 0, max: 1, interval: 0.25 };

  const roughStep = range / Math.max(targetTicks - 1, 1);
  const mag = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const norm = roughStep / mag;

  let step: number;
  if (norm <= 1) step = mag;
  else if (norm <= 2) step = 2 * mag;
  else if (norm <= 2.5) step = 2.5 * mag;
  else if (norm <= 5) step = 5 * mag;
  else step = 10 * mag;

  const min = Math.max(0, Math.floor(rawMin / step) * step);
  const max = Math.ceil(rawMax / step) * step;
  return { min, max, interval: step };
}

/** 1y collection chart — $100 steps up to ~$1k (design ref), else fall back to niceScale. */
export function yearViewPriceScale(
  rawMin: number,
  rawMax: number,
): { min: number; max: number; interval: number } {
  const paddedMax = rawMax * 1.06;
  if (!Number.isFinite(paddedMax) || paddedMax <= 0) {
    return { min: 0, max: 1000, interval: 100 };
  }
  if (paddedMax <= 1200) {
    const max = Math.max(100, Math.ceil(paddedMax / 100) * 100);
    return { min: 0, max, interval: 100 };
  }
  return niceScale(Math.max(0, rawMin), paddedMax, 6);
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
