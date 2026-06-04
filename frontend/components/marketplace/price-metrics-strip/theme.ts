/** Arial — collection detail metrics + order book (design feedback). */
export const collectionDetailArialClass = "font-[Arial,Helvetica,sans-serif]";

/** Shared with {@link MetricTile} `panelCell` variant — keep in sync. */
export const metricPanelLabelCls = `${collectionDetailArialClass} block text-pretty max-lg:text-[9px] max-lg:font-semibold max-lg:uppercase max-lg:leading-none max-lg:tracking-[0.07em] max-lg:text-zinc-500 lg:text-[16px] lg:font-normal lg:normal-case lg:leading-[150%] lg:tracking-[0px] lg:text-zinc-400`;

export const metricPanelValueWrapCls =
  "mt-0.5 flex w-full min-w-0 flex-wrap items-baseline gap-x-1 lg:mt-3 lg:min-h-[1.75rem]";

export const metricPanelValueCls = `${collectionDetailArialClass} min-w-0 max-w-full tabular-nums tracking-tight max-lg:text-[13px] max-lg:font-bold max-lg:leading-none max-lg:tracking-tight max-lg:tabular-nums lg:text-[clamp(0.9375rem,1.65vw,1.25rem)] lg:font-semibold lg:leading-[150%] lg:tracking-[0px] lg:tabular-nums lg:text-white`;

export const metricPanelInsetCls = "max-lg:px-2 max-lg:py-1.5 lg:px-2 lg:py-2.5 lg:first:pl-0";

/** Order book tab labels — same size as metric labels (Current Price, Chg, etc.). */
export const orderBookTabLabelCls = `${collectionDetailArialClass} text-[9px] font-semibold normal-case tracking-normal max-lg:uppercase max-lg:tracking-[0.07em] lg:text-[16px] lg:font-normal lg:leading-[150%] lg:tracking-[0px]`;

/** Order book + trades data rows — shared size/weight. */
export const orderBookTradesRowValueCls = `${collectionDetailArialClass} tabular-nums font-normal max-lg:text-[13px] max-lg:leading-[1.35] lg:text-[15px] lg:leading-[140%]`;

export const orderBookRowValueCls = orderBookTradesRowValueCls;

/** Order book column headers (Price, Side, Time). */
export const orderBookColumnHeaderCls = `${metricPanelLabelCls}`;

/** Trades / order book 3-column grid — equal width; Side/Size align start, Time/Total align end. */
export const ORDER_BOOK_THREE_COL_GRID = "grid grid-cols-3 gap-x-4 sm:gap-x-5";

export const orderBookColStartCls = "justify-self-start text-left";
export const orderBookColMidCls = "justify-self-start text-left pl-0";
export const orderBookColEndCls = "justify-self-end text-right";
