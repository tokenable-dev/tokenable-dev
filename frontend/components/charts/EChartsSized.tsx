"use client";

import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";
import { useElementSize } from "@/hooks/useElementSize";

// Deferred load: echarts + echarts-for-react together are ~1.3 MB minified.
// Splitting here keeps the bundle off every page that doesn't render a chart.
const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => null,
});

type EChartsSizedProps = {
  option: EChartsOption;
  className?: string;
  chartKey?: string | number;
  minHeight?: number;
};

/**
 * Mount ECharts only after the container has non-zero dimensions
 * (prevents "[ECharts] Can't get DOM width or height" on flex/hidden tabs).
 */
export function EChartsSized({
  option,
  className,
  chartKey,
  minHeight = 200,
}: EChartsSizedProps) {
  const { ref, width, height, ready } = useElementSize();

  return (
    <div
      ref={ref}
      className={className ?? "h-full min-h-0 w-full"}
      style={{ minHeight }}
    >
      {ready ? (
        <ReactECharts
          key={chartKey}
          option={option}
          notMerge
          lazyUpdate
          autoResize
          style={{ width, height }}
        />
      ) : null}
    </div>
  );
}
