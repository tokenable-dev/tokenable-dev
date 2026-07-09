"use client";

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
        <span className="cd-chart-panel__title">Price history</span>
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
