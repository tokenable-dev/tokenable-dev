/**
 * Visual chrome aligned with {@link CollectionCoverFrame} hero (gradient bezel + inner mat).
 * Used around the marketplace cluster on collection detail (chart · order book · trade).
 *
 * Mobile shell (tabs, compact hero): viewport below `lg` (1024px). Desktop chart + book: `lg` and up.
 */

/** Single flat fill for collection detail marketplace surfaces (no layered grays). */
export const COLLECTION_DETAILS_BG_CLASS = "bg-[rgba(11,13,16,1)]";

/** Borders / dividers that blend into the panel (same rgb as fill). */
export const COLLECTION_DETAILS_BORDER_ALL = "border border-[rgba(11,13,16,1)]";
export const COLLECTION_DETAILS_BORDER_B = "border-b border-[rgba(11,13,16,1)]";
export const COLLECTION_DETAILS_BORDER_T = "border-t border-[rgba(11,13,16,1)]";
export const COLLECTION_DETAILS_BORDER_Y = "border-y border-[rgba(11,13,16,1)]";

/** Inner mat — slightly tighter top padding so metrics align with hero cover band. */
export const COLLECTION_MARKET_CLUSTER_MAT =
  `rounded-[1.15rem] sm:rounded-[1.2rem] ${COLLECTION_DETAILS_BG_CLASS} px-2.5 pt-2 max-lg:pb-1.5 pb-2.5 sm:px-3.5 sm:pt-2.5 sm:pb-3.5 lg:px-4 lg:pt-2 lg:pb-4`;

/** Outer rim — tight ring matching {@link CollectionCoverFrame} hero bezel thickness. */
export const COLLECTION_MARKET_CLUSTER_BEZEL =
  `p-[2px] sm:p-[3px] rounded-[1.28rem] sm:rounded-[1.35rem] ${COLLECTION_DETAILS_BG_CLASS}`;

/**
 * Figma order book frame beside chart: 221×409 (legacy); desktop row height matches chart (`lg`+).
 * `border-radius: 8px`, `border-width: 1px`.
 */
export const COLLECTION_MARKETS_CHART_ROW_HEIGHT_CLASS =
  "lg:h-[200px] lg:max-h-[200px]";

export const COLLECTION_MARKETS_ORDER_BOOK_FRAME =
  `w-[min(100%,221px)] shrink-0 rounded-lg border border-[rgba(38,39,45,1)] bg-[rgb(20,20,21)] sm:w-[221px] max-lg:h-[min(300px,44svh)] max-lg:w-full ${COLLECTION_MARKETS_CHART_ROW_HEIGHT_CLASS}`;

/** Dual chart in collection markets mat — same fill as mat; no inset border/frame line. */
export const COLLECTION_CHART_SURFACE =
  `w-full min-w-0 min-h-0 overflow-hidden rounded-lg ${COLLECTION_DETAILS_BG_CLASS} text-white`;

/** Chart column height in collection detail markets cluster (desktop). */
export const COLLECTION_MARKETS_CHART_HEIGHT_CLASS = COLLECTION_MARKETS_CHART_ROW_HEIGHT_CLASS;

/** Chart column height when shown inline on mobile (non-tab layout). */
export const COLLECTION_MARKETS_CHART_HEIGHT_MOBILE_CLASS =
  "max-lg:h-[min(180px,30svh)] max-lg:shrink-0";

/** Chart panel inside mobile Information / Chart / Book tabs. */
export const COLLECTION_MARKETS_CHART_TAB_HEIGHT_CLASS = "h-[120px]";

/** Scrollable order book panes — dark scrollbar (see `.scrollbar-dark` in globals.css). */
export const COLLECTION_ORDER_BOOK_SCROLL_CLASS = "scrollbar-dark";

/** Individual listing cards in collection exchange (`CollectionRwaCard`): no stroke; fills only. */
export const COLLECTION_LISTING_CARD_CHROME = "rounded-lg bg-black overflow-hidden";
