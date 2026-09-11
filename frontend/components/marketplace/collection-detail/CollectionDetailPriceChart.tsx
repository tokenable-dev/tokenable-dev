"use client";

import type { ReactNode } from "react";
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
  99999: "All",
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
    const winLbl = PERIOD_LABELS[days] ?? (days >= 10000 ? "All" : `${days}d`);
  return {
    arrow: up ? "▲" : "▼",
    rest: `${up ? "+" : ""}${pc.toFixed(1)}% · ${winLbl}`,
    up,
  };
}

/**
 * Card.html `#chart-card` — optional embedded hero + price history + chart.
 */
export function CollectionDetailPriceChart({
  chartProps,
  gradeChart,
  mobileLayout = false,
  heroSlot,
  mdPanel,
}: {
  chartProps: CollectionDualPriceChartProps;
  gradeChart: GradeChartSlice;
  /** Card.html mobile scroll column — show header + full-height chart. */
  mobileLayout?: boolean;
  /** Design-30: `#hero-bar` + `#hero-stats` nest inside the chart notch. */
  heroSlot?: ReactNode;
  /** Card.html `#md-panel` — stats under the chart on narrow viewports. */
  mdPanel?: ReactNode;
}) {
  const change = useMemo(
    () => windowChange(chartProps.externalRollingUsd, gradeChart.chartDays),
    [chartProps.externalRollingUsd, gradeChart.chartDays],
  );
  const withHero = heroSlot != null;

  return (
    <div
      className={`cd-chart-panel cd-notch${
        mobileLayout ? " cd-chart-panel--embed" : ""
      }${withHero ? " cd-chart-panel--with-hero" : ""}`}
      id="chart-card"
    >
      {withHero ? <div className="cd-chart-panel__hero">{heroSlot}</div> : null}
      <div className="cd-chart-panel__plot">
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
        {mdPanel}
      </div>
    </div>
  );
}
