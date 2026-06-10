/** Arial — collection detail metrics + order book (design feedback). */
export const collectionDetailArialClass = "font-[Arial,Helvetica,sans-serif]";

/** Shared with {@link MetricTile} `panelCell` variant — keep in sync. */
export const metricPanelLabelCls = `${collectionDetailArialClass} block min-w-0 max-w-full text-pretty max-lg:text-[9px] max-lg:font-semibold max-lg:uppercase max-lg:leading-none max-lg:tracking-[0.07em] max-lg:text-zinc-500 lg:truncate lg:text-[clamp(10px,2.6cqw,16px)] lg:font-normal lg:normal-case lg:leading-[1.35] lg:tracking-[0px] lg:text-zinc-400`;

export const metricPanelValueWrapCls =
  "mt-0.5 flex w-full min-w-0 flex-wrap items-baseline gap-x-1 lg:mt-2 lg:min-h-[1.5rem] lg:flex-nowrap lg:overflow-hidden xl:mt-3 xl:min-h-[1.75rem]";

export const metricPanelValueCls = `${collectionDetailArialClass} block min-w-0 max-w-full tabular-nums tracking-tight max-lg:text-[13px] max-lg:font-bold max-lg:leading-none max-lg:tracking-tight max-lg:tabular-nums lg:truncate lg:text-[clamp(0.6875rem,3.4cqw,1.25rem)] lg:font-semibold lg:leading-[1.35] lg:tracking-[0px] lg:tabular-nums lg:text-white`;

/** First {@link MetricTile} panelCell column — shared x-origin for order book tabs/headers. */
export const metricPanelLeadingInsetXCls =
  "max-lg:px-2 lg:pl-[clamp(8px,1.8cqw,12px)] lg:pr-[clamp(2px,0.45cqw,4px)]";

export const metricPanelLeadingInsetCls = `${metricPanelLeadingInsetXCls} max-lg:py-1.5 lg:py-2 xl:py-2.5`;

export const metricPanelInsetCls =
  "max-lg:py-1.5 lg:px-[clamp(2px,0.45cqw,4px)] lg:py-2 lg:first:pl-[clamp(8px,1.8cqw,12px)] xl:py-2.5 max-lg:px-2";

/** Order book tab labels (Trades / Order book / Orders) — primary navigation row. */
export const orderBookTabLabelCls = `${collectionDetailArialClass} whitespace-nowrap text-[13px] font-semibold normal-case leading-none tracking-normal lg:text-[16px]`;

/** Order book + trades data rows — shared size/weight. */
export const orderBookTradesRowValueCls = `${collectionDetailArialClass} tabular-nums font-normal max-lg:text-[13px] max-lg:leading-[1.35] lg:text-[15px] lg:leading-[140%]`;

export const orderBookRowValueCls = orderBookTradesRowValueCls;

/** Order book column headers (Price, Side, Time) — distinct from tabs via case/color, not tiny type. */
export const orderBookColumnHeaderCls = `${collectionDetailArialClass} text-[11px] font-medium uppercase leading-none tracking-[0.08em] text-zinc-500 lg:text-[13px] lg:tracking-[0.07em]`;

/** Trades / order book 3-column grid — equal width; Price left, middle centered, Total/Time right. */
export const ORDER_BOOK_THREE_COL_GRID = "grid grid-cols-3 gap-x-4 sm:gap-x-5";

export const orderBookColStartCls = "justify-self-start text-left";
export const orderBookColMidCls = "justify-self-start text-left pl-0";
export const orderBookColEndCls = "justify-self-end text-right";

/** Order book flush — Size centered in its column; Total aligns right. */
export const orderBookBookSizeColCls = "justify-self-center text-center tabular-nums";

/** Trades flush — Side centered in its column; Time values align to column end. */
export const orderBookTradesSideColCls = "justify-self-center text-center";
export const orderBookTradesTimeColCls = `${orderBookColEndCls} tabular-nums`;
/** Trades column header only — "Time" label inset slightly left of the value edge. */
export const orderBookTradesTimeHeaderColCls =
  "justify-self-end pr-3.5 text-right sm:pr-4";
