import { IBM_Plex_Sans } from "next/font/google";

export const rwaDetailRightFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

/** Card detail CTAs — slight corner radius (not pill). */
export const RWA_DETAIL_BUTTON_FRAME_ROUNDED = "rounded-lg";
export const RWA_DETAIL_BUTTON_RIM_PAD_CLASS = "p-[2px]";
export const RWA_DETAIL_BUTTON_INNER_ROUNDED = "!rounded-[6px]";

/** Mobile sticky footer — pill CTAs matching design spec. */
export const RWA_DETAIL_MOBILE_CTA_FRAME_ROUNDED = "rounded-2xl";
export const RWA_DETAIL_MOBILE_CTA_RIM_PAD_CLASS = "p-[3px]";
export const RWA_DETAIL_MOBILE_CTA_INNER_ROUNDED = "!rounded-[13px]";
export const RWA_DETAIL_BUY_NOW_TEXT_CLASS = "!text-[#10D333]";
export const RWA_DETAIL_BUY_NOW_FRAME_SHADOW =
  "shadow-[0_0_16px_-10px_rgba(16,211,51,0.22),0_0_24px_-14px_rgba(0,107,107,0.1)] has-[:enabled]:hover:shadow-[0_0_24px_-6px_rgba(16,211,51,0.38),0_0_36px_-10px_rgba(0,107,107,0.16)]";
export const RWA_DETAIL_PLACE_BID_FRAME_SHADOW =
  "shadow-[0_0_20px_-6px_rgba(200,212,222,0.28)] has-[:enabled]:hover:shadow-[0_0_28px_-4px_rgba(220,228,236,0.38)]";

/** Design ref omits external reference + period change on card detail — set true to re-enable. */
export const RWA_DETAIL_SHOW_MARKET_CONTEXT = false;

/** Slab headline muted blue-grey — mobile caption line 1. */
export const RWA_DETAIL_SLAB_TITLE_MUTED_COLOR_CLASS = "text-[#8BA1B3]";
/** Desktop right sidebar title — same tone as mobile, smaller than legacy hero sizing. */
export const RWA_DETAIL_DESKTOP_SIDEBAR_TITLE_CLASS = `${RWA_DETAIL_SLAB_TITLE_MUTED_COLOR_CLASS} min-w-0 whitespace-normal break-words text-[15px] font-semibold leading-[1.2] tracking-wide [overflow-wrap:anywhere] sm:text-[16px]`;
export const RWA_DETAIL_DESKTOP_SIDEBAR_CERT_CLASS =
  "font-bold tabular-nums text-white";

/**
 * Mobile RWA hero — scales to parent width; height capped with svh + reserved chrome
 * (header, 3-line caption, sticky CTAs, safe-area) so short / notched devices do not clip.
 */
export const RWA_MOBILE_SLAB_MAX_WIDTH_CLASS = "max-w-[min(100%,480px)]";
export const RWA_MOBILE_SLAB_MAX_HEIGHT_CLASS =
  "max-h-[min(480px,68svh,calc(100svh-4rem-11.5rem-env(safe-area-inset-bottom,0px)))]";
/** Image + caption column — hugs rendered slab width (not letterboxed container). */
export const RWA_MOBILE_SLAB_STACK_CLASS = `mx-auto flex w-fit min-w-0 ${RWA_MOBILE_SLAB_MAX_WIDTH_CLASS} flex-col items-stretch`;
/** Even padding on caption block (top/bottom match; width aligns with card edges). */
export const RWA_MOBILE_SLAB_CAPTION_BLOCK_CLASS = "w-full shrink-0 pt-3 pb-3 text-left";
export const RWA_MOBILE_SLAB_CAPTION_LINE_GAP_CLASS = "gap-1.5";
/** Bottom inset above fixed purchase footer (dual CTA + safe-area). */
export const RWA_MOBILE_STICKY_FOOTER_RESERVE_CLASS =
  "max-lg:pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]";
