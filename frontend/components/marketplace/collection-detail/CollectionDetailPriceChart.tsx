"use client";

import { CollectionDualPriceChart } from "@/components/marketplace/collection-dual-price-chart";
import type { CollectionDualPriceChartProps } from "@/components/marketplace/collection-dual-price-chart";
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
  gradeChart: _gradeChart,
  embedInMobileTab = false,
}: {
  chartProps: CollectionDualPriceChartProps;
  /** Grade/range state still drives series data; toolbar hidden for now. */
  gradeChart: GradeChartSlice;
  embedInMobileTab?: boolean;
}) {
  return (
    <CollectionDualPriceChart
      {...chartProps}
      chartToolbar={null}
      embedInMobileTab={embedInMobileTab}
    />
  );
}
