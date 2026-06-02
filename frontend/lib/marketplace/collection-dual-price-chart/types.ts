import type { CollectionUsdPoint } from "@/lib/core";

export type ChartRangeOption = {
  id: string;
  label: string;
};

export type MergedExternalChartData = {
  tMin: number;
  tMax: number;
  vMin: number;
  vMax: number;
  extIsPolyline: boolean;
  hasExtSignal: boolean;
  fixedWindowDays: number | null;
  externalSeries: Array<[number, number]>;
};

export type MergeExternalChartSeriesInput = {
  externalRollingUsd?: CollectionUsdPoint[] | null;
  externalMarketUsd?: number | null;
  externalWindowDays?: number | null;
  nowSec: number;
};
