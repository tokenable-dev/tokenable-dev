"use client";

import type { ReactNode } from "react";
import { CollectionPriceHistoryPlaceholder } from "@/components/marketplace/markets-ui";

export function CollectionOverviewChartPanel({
  mode,
  chartMetricsRow,
  priceChart,
  tradePanel,
}: {
  mode: "trade-sidebar" | "classic";
  chartMetricsRow?: ReactNode;
  priceChart?: ReactNode;
  tradePanel?: ReactNode;
}) {
  if (mode === "trade-sidebar" && tradePanel != null) {
    return (
      <div className="mx-auto grid w-full min-w-0 max-w-6xl grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,min(440px,36vw))]">
        <div className="flex min-w-0 w-full flex-col gap-3">
          {chartMetricsRow != null ? (
            <div className="w-full min-w-0 shrink-0">{chartMetricsRow}</div>
          ) : null}
          {priceChart ?? (
            <CollectionPriceHistoryPlaceholder className="min-h-[180px] w-full sm:min-h-[225px]" />
          )}
        </div>
        <div className="min-w-0 w-full lg:sticky lg:top-4 lg:justify-self-stretch">
          {tradePanel}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-3">
      {chartMetricsRow != null ? (
        <div className="w-full min-w-0 shrink-0">{chartMetricsRow}</div>
      ) : null}
      {priceChart ?? (
        <CollectionPriceHistoryPlaceholder className="min-h-[180px] w-full sm:min-h-[210px]" />
      )}
    </div>
  );
}
