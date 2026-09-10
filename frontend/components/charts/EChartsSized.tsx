"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
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
 * Stay mounted if size briefly hits 0 — unmount+dataZoom dispose crashes ECharts 6
 * (`__ec_inner_*` on roam records).
 */
export function EChartsSized({
  option,
  className,
  chartKey,
  minHeight = 200,
}: EChartsSizedProps) {
  const { ref, width, height } = useElementSize();
  const [canDraw, setCanDraw] = useState(false);

  useEffect(() => {
    if (width > 8 && height > 8) setCanDraw(true);
  }, [width, height]);

  return (
    <div
      ref={ref}
      className={className ?? "h-full min-h-0 w-full"}
      style={{ minHeight }}
    >
      {canDraw ? (
        <ReactECharts
          key={chartKey}
          option={option}
          notMerge
          lazyUpdate
          autoResize
          opts={{ renderer: "canvas" }}
          style={{ width: "100%", height: "100%", minHeight }}
        />
      ) : null}
    </div>
  );
}
