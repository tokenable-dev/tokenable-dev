/**
 * Visual chrome aligned with {@link CollectionCoverFrame} hero (gradient bezel + inner mat).
 * Used around the marketplace cluster on collection detail (chart · order book · trade).
 */

/** Single flat fill for collection detail marketplace surfaces (no layered grays). */
export const COLLECTION_DETAILS_BG_CLASS = "bg-[rgba(11,13,16,1)]";

/** Borders / dividers that blend into the panel (same rgb as fill). */
export const COLLECTION_DETAILS_BORDER_ALL = "border border-[rgba(11,13,16,1)]";
export const COLLECTION_DETAILS_BORDER_B = "border-b border-[rgba(11,13,16,1)]";
export const COLLECTION_DETAILS_BORDER_T = "border-t border-[rgba(11,13,16,1)]";
export const COLLECTION_DETAILS_BORDER_Y = "border-y border-[rgba(11,13,16,1)]";
export const COLLECTION_DETAILS_DIVIDE_X = "divide-x divide-[rgba(11,13,16,1)]";

/** Inner mat — slightly tighter top padding so metrics align with hero cover band (exchange row). */
export const COLLECTION_MARKET_CLUSTER_MAT =
  `rounded-[1.15rem] sm:rounded-[1.2rem] ${COLLECTION_DETAILS_BG_CLASS} px-2.5 pt-2 pb-2.5 sm:px-3.5 sm:pt-2.5 sm:pb-3.5 lg:px-4 lg:pt-2 lg:pb-4`;

/** Outer rim — tight ring matching {@link CollectionCoverFrame} hero bezel thickness. */
export const COLLECTION_MARKET_CLUSTER_BEZEL =
  `p-[2px] sm:p-[3px] rounded-[1.28rem] sm:rounded-[1.35rem] ${COLLECTION_DETAILS_BG_CLASS}`;

/** Nested split pane (order book | trade) — Figma panel chrome; width/height follow layout unless {@link COLLECTION_EXCHANGE_ORDER_BOOK_FRAME}. */
export const COLLECTION_MARKET_SPLIT_CHROME =
  `overflow-hidden rounded-lg border border-[rgba(38,39,45,1)] bg-[rgb(20,20,21)] divide-x divide-[rgba(38,39,45,1)]`;

/**
 * Figma order book frame beside chart: 221×409, `border-radius: 8px`, `border-width: 1px`, opacity 1.
 * (`top` / `left` from design are artboard-relative — layout uses grid flow, not fixed coordinates.)
 */
export const COLLECTION_EXCHANGE_ORDER_BOOK_FRAME =
  "h-[409px] w-[min(100%,221px)] shrink-0 rounded-lg border border-[rgba(38,39,45,1)] bg-[rgb(20,20,21)] sm:w-[221px]";

/** Dual chart in collection exchange mat — same fill as mat; no inset border/frame line. */
export const COLLECTION_CHART_SURFACE =
  `w-full min-w-0 min-h-0 overflow-hidden rounded-lg ${COLLECTION_DETAILS_BG_CLASS} text-white`;

/** Individual listing cards in collection exchange (`CollectionRwaCard`): no stroke; fills only. */
export const COLLECTION_LISTING_CARD_CHROME = "rounded-lg bg-black overflow-hidden";
