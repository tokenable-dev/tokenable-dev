import { orderBookTradesContentValueCls } from "@/components/marketplace/price-metrics-strip/theme";

/** Visible trade rows before wheel scroll (collection + RWA Trades tab). */
export const TRADES_TAPE_TARGET_VISIBLE_ROWS = 9;

/**
 * Flush row height (px) — keep in sync with {@link TRADES_TAPE_FLUSH_ROW_CLASS}
 * (py-1.5×2 + 13px leading-snug + 1px divider).
 */
export const TRADES_TAPE_FLUSH_ROW_HEIGHT_PX = 29;

export function tradesTapeScrollHeightPx(
  visibleRows = TRADES_TAPE_TARGET_VISIBLE_ROWS,
): number {
  return visibleRows * TRADES_TAPE_FLUSH_ROW_HEIGHT_PX;
}

/** Fixed viewport — 9 rows × {@link TRADES_TAPE_FLUSH_ROW_HEIGHT_PX}px; overflow scrolls. */
export const TRADES_TAPE_SCROLL_HEIGHT_CLASS = "h-[261px] max-h-[261px]";

/** Shared flush / card-detail trade row — tight single-line rows with dividers. */
export const TRADES_TAPE_FLUSH_ROW_CLASS = `border-b border-zinc-800/40 py-1.5 last:border-b-0 ${orderBookTradesContentValueCls} text-[13px] leading-snug text-zinc-200`;

export const TRADES_TAPE_FLUSH_HEADER_CLASS =
  "shrink-0 border-b border-zinc-800/55 pb-1.5";
