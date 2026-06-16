"use client";

import { CollectionDualPriceChart } from "@/components/marketplace/collection-dual-price-chart";
import type { CollectionDualPriceChartProps } from "@/components/marketplace/collection-dual-price-chart";
import { CollectionGradeChartToolbar } from "@/components/marketplace/collection-grade-chart";
import type { useCollectionGradeChart } from "@/hooks/collection-grade-chart";

type GradeChartSlice = Pick<
  ReturnType<typeof useCollectionGradeChart>,
  | "gradeOptions"
  | "activeGrade"
  | "setSelectedGrade"
  | "chartDays"
  | "setChartDays"
  | "catalogLoading"
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
  const chartToolbar = (
    <CollectionGradeChartToolbar
      gradeOptions={gradeChart.gradeOptions}
      activeGrade={gradeChart.activeGrade}
      onGradeChange={(g) => gradeChart.setSelectedGrade(g)}
      chartDays={gradeChart.chartDays}
      onChartDaysChange={gradeChart.setChartDays}
      disabled={gradeChart.catalogLoading}
    />
  );

  return (
    <CollectionDualPriceChart
      {...chartProps}
      chartToolbar={chartToolbar}
      embedInMobileTab={embedInMobileTab}
    />
  );
}
