import {
  metricPanelLeadingInsetCls,
  metricPanelLeadingInsetXCls,
} from "@/components/marketplace/price-metrics-strip/theme";

/**
 * Visual chrome aligned with {@link CollectionCoverFrame} hero (gradient bezel + inner mat).
 * Used around the marketplace cluster on collection detail (chart · order book · trade).
 *
 * Mobile shell (tabs, compact hero): viewport below `lg` (1024px). Desktop chart + book: `lg` and up.
 */

/** Single flat fill — matches site root (`globals.css` `--background: #000`). */
export const COLLECTION_DETAILS_BG_CLASS = "bg-black";

/** Borders / dividers that blend into the panel (same as fill). */
export const COLLECTION_DETAILS_BORDER_ALL = "border border-black";
export const COLLECTION_DETAILS_BORDER_B = "border-b border-black";
export const COLLECTION_DETAILS_BORDER_T = "border-t border-black";
export const COLLECTION_DETAILS_BORDER_Y = "border-y border-black";

/** Inner mat — slightly tighter top padding so metrics align with hero cover band. */
export const COLLECTION_MARKET_CLUSTER_MAT =
  `rounded-[1.15rem] sm:rounded-[1.2rem] ${COLLECTION_DETAILS_BG_CLASS} px-2.5 pt-2 max-lg:pb-1.5 pb-2.5 sm:px-3.5 sm:pt-2.5 sm:pb-3.5 lg:pl-5 lg:pr-4 lg:pt-2 lg:pb-4`;

/** Flush order book — x-axis aligned with {@link MetricTile} panelCell (first column). */
export const COLLECTION_ORDER_BOOK_FLUSH_INSET = metricPanelLeadingInsetCls;
export const COLLECTION_ORDER_BOOK_FLUSH_INSET_X = metricPanelLeadingInsetXCls;

/** Outer rim — tight ring matching {@link CollectionCoverFrame} hero bezel thickness. */
export const COLLECTION_MARKET_CLUSTER_BEZEL =
  `p-[2px] sm:p-[3px] rounded-[1.28rem] sm:rounded-[1.35rem] ${COLLECTION_DETAILS_BG_CLASS}`;

/**
 * Desktop chart band — height also sets the flush order book / Trades column (`lg`+).
 * Taller band → more trade rows and book depth visible before scroll.
 */
export const COLLECTION_MARKETS_CHART_ROW_HEIGHT_CLASS =
  "lg:h-[300px] lg:max-h-[300px]";

/** Desktop order book column beside chart (collection detail). */
export const COLLECTION_MARKETS_ORDER_BOOK_COLUMN_WIDTH_CLASS =
  "lg:w-[320px] lg:max-w-[320px] lg:shrink-0";

/** Desktop: stretches with markets cluster right column; mobile keeps capped height. */
export const COLLECTION_MARKETS_ORDER_BOOK_FRAME =
  `w-[min(100%,320px)] shrink-0 rounded-lg ${COLLECTION_DETAILS_BG_CLASS} max-lg:h-[min(400px,54svh)] max-lg:w-full lg:min-h-0 lg:w-[320px] lg:max-w-[320px] lg:flex-1`;

/**
 * Markets cluster grid when chart + order book share a row (desktop).
 * Trailing track keeps the book column off the panel’s right edge (shift left toward chart).
 */
export const COLLECTION_MARKETS_CLUSTER_GRID_COLS_CLASS =
  "lg:grid-cols-[minmax(0,1fr)_320px_minmax(1.25rem,2rem)]";

/** Dual chart in collection markets mat — same fill as mat; no inset border/frame line. */
export const COLLECTION_CHART_SURFACE =
  `w-full min-w-0 min-h-0 overflow-hidden rounded-lg ${COLLECTION_DETAILS_BG_CLASS} text-white`;

/** Chart column height in collection detail markets cluster (desktop). */
export const COLLECTION_MARKETS_CHART_HEIGHT_CLASS = COLLECTION_MARKETS_CHART_ROW_HEIGHT_CLASS;

/**
 * Desktop hero cover height — bottom edge aligns with top of the listings card row
 * (cluster inset + metrics strip + chart band + row gaps).
 */
export const COLLECTION_HERO_DESKTOP_HEIGHT_CLASS =
  "lg:h-[calc(10px+116px+0.75rem+300px+0.75rem+0.25rem)] lg:max-h-[calc(10px+116px+0.75rem+300px+0.75rem+0.25rem)]";

/** Chart column height when shown inline on mobile (scroll panel + non-tab layout). */
export const COLLECTION_MARKETS_CHART_HEIGHT_MOBILE_CLASS =
  "max-lg:h-[min(150px,26svh)] max-lg:shrink-0";

/** Chart panel inside mobile Information / Chart / Book tabs. */
export const COLLECTION_MARKETS_CHART_TAB_HEIGHT_CLASS = "h-[120px]";

/** Order book tab on mobile — content height (3 bid + 3 ask rows); no fixed min reserve. */
export const COLLECTION_MARKETS_ORDER_BOOK_TAB_HEIGHT_CLASS = "min-h-0 h-auto";

/** Scrollable order book panes — dark scrollbar (see `.scrollbar-dark` in globals.css). */
export const COLLECTION_ORDER_BOOK_SCROLL_CLASS = "scrollbar-dark";

/** Individual listing cards in collection exchange (`CollectionRwaCard`): no stroke; fills only. */
export const COLLECTION_LISTING_CARD_CHROME = "rounded-lg bg-black overflow-hidden";
