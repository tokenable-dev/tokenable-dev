import type { CollectionUsdPoint } from "@/lib/core";
import { CHART_DAY_SEC } from "./constants";

export function utcDayKey(tSec: number): string {
  const d = new Date(tSec * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

export function validUsdPoints(points: CollectionUsdPoint[]): CollectionUsdPoint[] {
  return points.filter(
    (p) =>
      Number.isFinite(p.t) && typeof p.v === "number" && Number.isFinite(p.v) && p.v > 0,
  );
}

/** Latest in-window price, else headline spot fallback. */
export function resolveExternalReferencePrice(
  points: CollectionUsdPoint[],
  fallbackUsd: number | null | undefined,
): number | null {
  const valid = validUsdPoints(points);
  if (valid.length > 0) return valid[valid.length - 1]!.v;
  if (fallbackUsd != null && Number.isFinite(fallbackUsd) && fallbackUsd > 0) {
    return fallbackUsd;
  }
  return null;
}

export function isUniformPrice(points: CollectionUsdPoint[]): boolean {
  const valid = validUsdPoints(points);
  if (valid.length <= 1) return valid.length === 1;
  const v0 = valid[0]!.v;
  const tol = Math.max(v0 * 1e-4, 0.01);
  return valid.every((p) => Math.abs(p.v - v0) <= tol);
}

export function buildFullWindowFlatSeries(
  tMin: number,
  tMax: number,
  price: number,
): CollectionUsdPoint[] {
  return [
    { t: tMin, v: price },
    { t: tMax, v: price },
  ];
}

/** Carry first/last known prices to the UI window edges (sparse Cardhedger history). */
export function extendSeriesToWindowEdges(
  points: CollectionUsdPoint[],
  tMin: number,
  tMax: number,
): CollectionUsdPoint[] {
  const valid = validUsdPoints(points).sort((a, b) => a.t - b.t);
  if (valid.length === 0) return [];
  if (valid.length === 1) {
    return buildFullWindowFlatSeries(tMin, tMax, valid[0]!.v);
  }

  const first = valid[0]!;
  const last = valid[valid.length - 1]!;
  const merged: CollectionUsdPoint[] = [];

  if (first.t > tMin + 60) merged.push({ t: tMin, v: first.v });
  for (const p of valid) {
    merged.push({ t: Math.min(Math.max(p.t, tMin), tMax), v: p.v });
  }
  if (last.t < tMax - 60) merged.push({ t: tMax, v: last.v });

  const deduped: CollectionUsdPoint[] = [];
  for (const p of merged) {
    if (deduped.length && deduped[deduped.length - 1]!.t === p.t) {
      deduped[deduped.length - 1] = p;
    } else {
      deduped.push(p);
    }
  }
  return deduped.length >= 2 ? deduped : buildFullWindowFlatSeries(tMin, tMax, last.v);
}

/** Few samples or short span vs 90D+ window — extend edges instead of a tight cluster. */
export function shouldAnchorSparseWindow(
  points: CollectionUsdPoint[],
  tMin: number,
  tMax: number,
  windowDays: number,
): boolean {
  const valid = validUsdPoints(points);
  if (valid.length <= 1) return true;
  const windowSpan = Math.max(tMax - tMin, 1);
  const dataSpan = Math.max(valid[valid.length - 1]!.t - valid[0]!.t, 0);
  const dataSpanDays = dataSpan / CHART_DAY_SEC;
  const ARCHIVE_WINDOW_DAYS = 500;
  if (windowDays >= ARCHIVE_WINDOW_DAYS && windowDays > dataSpanDays * 1.5 + 14) {
    return false;
  }
  if (dataSpan / windowSpan < 0.55) return true;
  if (windowDays >= 90 && valid.length < Math.max(4, Math.ceil(windowDays / 14))) {
    return true;
  }
  return false;
}

export function buildPlatformUtcDayStaticPoints(
  points: CollectionUsdPoint[],
  nowSec: number,
): CollectionUsdPoint[] {
  if (points.length === 0) return [];
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const byDay = new Map<string, CollectionUsdPoint>();
  for (const p of sorted) {
    if (!(typeof p.v === "number" && Number.isFinite(p.v) && p.v > 0)) continue;
    const k = utcDayKey(p.t);
    const prev = byDay.get(k);
    if (!prev || p.t >= prev.t) byDay.set(k, p);
  }

  const out: CollectionUsdPoint[] = [];
  for (const k of [...byDay.keys()].sort()) {
    const last = byDay.get(k)!;
    const [y, mo, d] = k.split("-").map(Number);
    const tNoon = Math.floor(Date.UTC(y!, mo! - 1, d!, 12, 0, 0) / 1000);
    out.push({ t: Math.min(tNoon, nowSec), v: last.v });
  }
  return out;
}
