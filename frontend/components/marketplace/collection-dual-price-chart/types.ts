import type { ReactNode } from "react";
import type { CollectionUsdPoint } from "@/lib/core";
import type { ChartRangeOption } from "@/lib/marketplace/collection-dual-price-chart";

export type { ChartRangeOption };

export type CollectionDualPriceChartProps = {
  /** On-platform trade points; not drawn in the chart (live market / external only). */
  platformUsd: CollectionUsdPoint[];
  externalMarketUsd?: number | null;
  externalWindowDays?: number | null;
  externalRollingUsd?: CollectionUsdPoint[] | null;
  externalRollingKind?: "history" | "snapshot" | "synthetic";
  externalLegendLabel?: string;
  externalSeriesShortLabel?: string;
  externalRefLineTag?: string;
  chartTitle?: string;
  /** @deprecated Prefer rangeOptions + chartRange + onChartRangeChange (in-chart toolbar). */
  controls?: ReactNode;
  rangeOptions?: readonly ChartRangeOption[];
  chartRange?: string;
  onChartRangeChange?: (id: string) => void;
  emptyStateMessage?: string;
  isLoading?: boolean;
  errorMessage?: string | null;
  variant?: "default" | "markets";
  /** Card.html blue chart on collection detail. */
  colorTheme?: "default" | "collection-detail";
  /** When `variant` is `markets` and true, shell matches collection cover mat tones. */
  collectionOverviewMat?: boolean;
  /** Fixed-height mobile tab panel — do not stretch to fill viewport. */
  embedInMobileTab?: boolean;
  /** Grade selector + period toolbar (collection detail multi-grade chart). */
  chartToolbar?: ReactNode;
};
