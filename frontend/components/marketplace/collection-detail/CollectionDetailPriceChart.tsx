"use client";

import { useMemo } from "react";
import { CollectionDualPriceChart } from "@/components/marketplace/collection-dual-price-chart";
import type { CollectionDualPriceChartProps } from "@/components/marketplace/collection-dual-price-chart";
import type { useCollectionGradeChart } from "@/hooks/collection-grade-chart";
import { CollectionDetailChartPeriodToolbar } from "./CollectionDetailChartPeriodToolbar";

type GradeChartSlice = Pick<
  ReturnType<typeof useCollectionGradeChart>,
  | "gradeOptions"
  | "activeGrade"
  | "setSelectedGrade"
  | "chartDays"
  | "setChartDays"
  | "catalogLoading"
  | "gradeChartLoading"
>;

const PERIOD_LABELS: Record<number, string> = {
  30: "1M",
  90: "3M",
  180: "6M",
  365: "1Y",
};

function windowChange(
  points: CollectionDualPriceChartProps["externalRollingUsd"],
  days: number,
): { arrow: string; rest: string; up: boolean } | null {
  const pts = (points ?? []).filter(
    (p) => Number.isFinite(p.v) && p.v > 0 && Number.isFinite(p.t),
  );
  if (pts.length < 2) return null;
  const first = pts[0]!.v;
  const last = pts[pts.length - 1]!.v;
  if (!(first > 0)) return null;
  const pc = ((last - first) / first) * 100;
  const up = pc >= 0;
  const winLbl = PERIOD_LABELS[days] ?? `${days}d`;
  const mag = Math.abs(pc).toFixed(1);
  return {
    arrow: up ? "▲" : "▼",
    rest: `${up ? "+" : ""}${mag}% · ${winLbl}`,
    up,
  };
}

export function CollectionDetailPriceChart({
  chartProps,
  gradeChart,
  mobileLayout = false,
}: {
  chartProps: CollectionDualPriceChartProps;
  gradeChart: GradeChartSlice;
  /** Card.html mobile scroll column — show header + full-height chart. */
  mobileLayout?: boolean;
}) {
  const change = useMemo(
    () => windowChange(chartProps.externalRollingUsd, gradeChart.chartDays),
    [chartProps.externalRollingUsd, gradeChart.chartDays],
  );

  return (
    <div
      className={`cd-chart-panel cd-notch${
        mobileLayout ? " cd-chart-panel--embed" : ""
      }`}
    >
      <div
        className={`cd-chart-panel__header${
          mobileLayout ? "" : " max-lg:hidden"
        }`}
      >
        <div className="cd-chart-panel__head-left">
          <span className="cd-chart-panel__title">Price history</span>
          {change ? (
            <span
              className={`cd-chart-panel__chg tkl-mono${
                change.up ? " cd-chart-panel__chg--up" : " cd-chart-panel__chg--down"
              }`}
            >
              <span className="cd-chg-glyph" aria-hidden>
                {change.arrow}
              </span>{" "}
              {change.rest}
            </span>
          ) : null}
        </div>
        <CollectionDetailChartPeriodToolbar
          chartDays={gradeChart.chartDays}
          onChartDaysChange={gradeChart.setChartDays}
          disabled={gradeChart.gradeChartLoading}
        />
      </div>
      <div className="cd-chart-panel__body cd-chart-panel__body--card-html">
        <CollectionDualPriceChart
          {...chartProps}
          chartToolbar={null}
          embedInMobileTab={false}
          colorTheme="collection-detail"
        />
      </div>
    </div>
  );
}
