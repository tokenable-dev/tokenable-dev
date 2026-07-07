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
  embedInMobileTab = false,
}: {
  chartProps: CollectionDualPriceChartProps;
  gradeChart: GradeChartSlice;
  embedInMobileTab?: boolean;
}) {
  const showDesktopHeader = !embedInMobileTab;

  return (
    <div
      className={
        showDesktopHeader
          ? "cd-chart-panel cd-notch max-lg:rounded-none max-lg:bg-transparent max-lg:p-0"
          : "cd-chart-panel cd-chart-panel--embed"
      }
    >
      {showDesktopHeader ? (
        <div className="cd-chart-panel__header max-lg:hidden">
          <span className="cd-chart-panel__title">Price history</span>
          <CollectionDetailChartPeriodToolbar
            chartDays={gradeChart.chartDays}
            onChartDaysChange={gradeChart.setChartDays}
            disabled={gradeChart.gradeChartLoading}
          />
        </div>
      ) : null}
      <div className="cd-chart-panel__body cd-chart-panel__body--card-html">
        <CollectionDualPriceChart
          {...chartProps}
          chartToolbar={null}
          embedInMobileTab={embedInMobileTab}
          colorTheme="collection-detail"
        />
      </div>
    </div>
  );
}
