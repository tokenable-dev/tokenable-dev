import type { CollectionUsdPoint } from "@/lib/core";
import { CHART_DAY_SEC, CHART_HOUR_SEC } from "./constants";
import { computeSmartTimeDomain } from "./chartScale";
import {
  buildFullWindowFlatSeries,
  buildPlatformUtcDayStaticPoints,
  extendSeriesToWindowEdges,
  isUniformPrice,
  resolveExternalReferencePrice,
  shouldAnchorSparseWindow,
  validUsdPoints,
} from "./seriesUtils";
import type { MergeExternalChartSeriesInput, MergedExternalChartData } from "./types";

export function mergeExternalChartSeries(
  input: MergeExternalChartSeriesInput,
): MergedExternalChartData {
  const {
    externalRollingUsd,
    externalMarketUsd,
    externalWindowDays,
    nowSec,
    stretchToWindow = false,
  } = input;

  const extRolling = externalRollingUsd?.length
    ? [...externalRollingUsd].sort((a, b) => a.t - b.t)
    : [];

  const hasExtSignal =
    extRolling.length > 0 ||
    (externalMarketUsd != null && Number.isFinite(externalMarketUsd) && externalMarketUsd > 0);

  const useFixedWindow =
    hasExtSignal &&
    externalWindowDays != null &&
    Number.isFinite(externalWindowDays) &&
    externalWindowDays > 0;

  let tMin: number;
  let tMax: number;

  if (useFixedWindow) {
    const anchorSec = extRolling.length > 0 ? extRolling[extRolling.length - 1]!.t : nowSec;
    tMin = anchorSec - externalWindowDays! * CHART_DAY_SEC;
    tMax = Math.max(anchorSec, nowSec) + 6 * CHART_HOUR_SEC;
  } else {
    const extForSmart = extRolling.length > 0 ? extRolling : [];
    const smart = computeSmartTimeDomain(extForSmart, nowSec, 180 * CHART_DAY_SEC);
    tMin = smart.tMin;
    tMax = Math.max(smart.tMax, tMin + 60);
  }

  const extInWindow = extRolling.filter((p) => p.t >= tMin && p.t <= tMax);
  let extForChart = buildPlatformUtcDayStaticPoints(extInWindow, nowSec).map((p) => ({
    ...p,
    t: Math.min(Math.max(p.t, tMin), tMax),
  }));

  if (extForChart.length < 2) {
    const rawFit = validUsdPoints(extInWindow);
    if (rawFit.length >= 2) {
      extForChart = [...rawFit]
        .sort((a, b) => a.t - b.t)
        .map((p) => ({ ...p, t: Math.min(Math.max(p.t, tMin), tMax) }));
    }
  }

  if (useFixedWindow) {
    const refPrice = resolveExternalReferencePrice(extInWindow, externalMarketUsd);
    const seriesProbe =
      validUsdPoints(extForChart).length > 0
        ? extForChart
        : validUsdPoints(extInWindow).length > 0
          ? extInWindow
          : extRolling;
    const windowDays = externalWindowDays!;

    if (seriesProbe.length === 0) {
      if (refPrice != null) {
        extForChart = buildFullWindowFlatSeries(tMin, tMax, refPrice);
      }
    } else if (isUniformPrice(seriesProbe)) {
      const flatV = refPrice ?? seriesProbe[seriesProbe.length - 1]!.v;
      extForChart = buildFullWindowFlatSeries(tMin, tMax, flatV);
    } else if (
      stretchToWindow ||
      shouldAnchorSparseWindow(seriesProbe, tMin, tMax, windowDays)
    ) {
      extForChart = extendSeriesToWindowEdges(
        validUsdPoints(extForChart).length > 0 ? extForChart : seriesProbe,
        tMin,
        tMax,
      );
    }
  }

  const extIsPolyline = extForChart.length >= 2;

  const allV = [
    ...extForChart.map((p) => p.v),
    ...(extIsPolyline || externalMarketUsd == null ? [] : [externalMarketUsd]),
  ];

  if (allV.length === 0) {
    return {
      tMin,
      tMax,
      vMin: 0,
      vMax: 1,
      extIsPolyline: false,
      hasExtSignal,
      fixedWindowDays: useFixedWindow ? externalWindowDays! : null,
      externalSeries: [],
    };
  }

  const vMinD = Math.min(...allV);
  const vMaxD = Math.max(...allV);
  const vPad = Math.max((vMaxD - vMinD) * 0.08, vMaxD * 0.04, 0.5);

  return {
    tMin,
    tMax,
    vMin: Math.max(0, vMinD - vPad),
    vMax: vMaxD + vPad,
    extIsPolyline,
    hasExtSignal,
    fixedWindowDays: useFixedWindow ? externalWindowDays! : null,
    externalSeries: extForChart.map((p) => [p.t * 1000, p.v] as [number, number]),
  };
}
