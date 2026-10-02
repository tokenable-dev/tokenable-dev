"use client";

import type { ReactNode } from "react";
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
