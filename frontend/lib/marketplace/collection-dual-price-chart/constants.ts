export const LIVE_MARKET_LINE = "rgba(16, 211, 51, 1)";

/**
 * Card.html `#tk-chart` — line/fill follow window polarity:
 * last ≥ first → `rgb(0,200,100)`, else `rgb(245,51,44)`.
 * Period pills still use azure; tooltip drop-shadow stays azure.
 */
export const COLLECTION_DETAIL_CHART_LINE_UP = "rgb(0, 200, 100)";
export const COLLECTION_DETAIL_CHART_LINE_DOWN = "rgb(245, 51, 44)";
export const COLLECTION_DETAIL_LINE_WIDTH = 2.5;
/** Card.html x-axis date labels `rgba(255,255,255,0.5)`. */
export const COLLECTION_DETAIL_AXIS_LABEL = "rgba(255, 255, 255, 0.5)";
/** Card.html canvas `fMark` / `fDate` — CSS vars are invalid in ECharts canvas fonts. */
export const COLLECTION_DETAIL_CHART_MONO =
  "'JetBrains Mono', ui-monospace, monospace";
export const COLLECTION_DETAIL_CHART_MARK_FONT = 13;
export const COLLECTION_DETAIL_CHART_DATE_FONT = 12;
/** Card.html horizontal grid `rgba(255,255,255,0.06)`. */
export const COLLECTION_DETAIL_GRID_LINE = "rgba(255, 255, 255, 0.06)";

export function collectionDetailChartLineColor(up: boolean): string {
  return up
    ? COLLECTION_DETAIL_CHART_LINE_UP
    : COLLECTION_DETAIL_CHART_LINE_DOWN;
}

export function collectionDetailChartAreaGradient(up: boolean) {
  const rgb = up ? "0, 200, 100" : "245, 51, 44";
  return {
    type: "linear" as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: `rgba(${rgb}, 0.34)` },
      { offset: 1, color: `rgba(${rgb}, 0)` },
    ],
  };
}

/** Area under line — light mint wash; keep low alpha so panel reads as one surface. */
export const LIVE_MARKET_AREA_GRADIENT = {
  type: "linear" as const,
  x: 0,
  y: 0,
  x2: 0,
  y2: 1,
  colorStops: [
    { offset: 0, color: "rgba(16, 211, 51, 0.14)" },
    { offset: 0.55, color: "rgba(16, 211, 51, 0.04)" },
    { offset: 1, color: "rgba(16, 211, 51, 0)" },
  ],
};

/** X/Y tick labels — silver / light grey */
export const AXIS_LABEL = "rgba(190, 190, 195, 0.92)";
/** Mobile collection chart axis — design ref white labels */
export const AXIS_LABEL_MOBILE = "rgba(255, 255, 255, 0.95)";

export const LIVE_LINE_WIDTH = 3;
export const CHART_DAY_SEC = 86400;
export const CHART_HOUR_SEC = 3600;

/** Default collection price chart lookback (1 calendar year). */
export const COLLECTION_CHART_DEFAULT_WINDOW_DAYS = 365;
