export const LIVE_MARKET_LINE = "rgba(16, 211, 51, 1)";

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

export const LIVE_LINE_WIDTH = 3;
export const CHART_DAY_SEC = 86400;
export const CHART_HOUR_SEC = 3600;

/** Default collection price chart lookback (1 calendar year). */
export const COLLECTION_CHART_DEFAULT_WINDOW_DAYS = 365;
