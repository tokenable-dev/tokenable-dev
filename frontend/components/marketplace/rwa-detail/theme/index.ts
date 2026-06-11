/** RWA detail typography — design spec: Arial. */
export const RWA_DETAIL_FONT_CLASS =
  "[font-family:Arial,Helvetica,'Helvetica_Neue',sans-serif]";

export const rwaDetailRightFont = {
  className: RWA_DETAIL_FONT_CLASS,
};

/** Listing ask amount (e.g. $3,100) — sidebar / labeled price block. */
export const RWA_DETAIL_LISTING_PRICE_AMOUNT_CLASS =
  "text-[1.5rem] font-semibold leading-none tabular-nums text-white sm:text-[1.625rem]";

/** Extra space between price line and Buy now / Place bid row. */
export const RWA_DETAIL_CTA_ROW_TOP_CLASS = "mt-6";
/** Unlisted owner — List for sale / Connect (no price line above CTA). */
export const RWA_DETAIL_UNLISTED_CTA_ROW_TOP_CLASS = "mt-8";
/** Mobile sticky footer — inset above CTA when caption is the only content above. */
export const RWA_DETAIL_UNLISTED_CTA_FOOTER_LEAD_CLASS = "pt-8";
/** Mobile sticky footer — inset from viewport bottom (below CTAs). */
export const RWA_DETAIL_STICKY_FOOTER_PB_CLASS =
  "pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]";

/** Shared CTA height — mobile sticky + desktop gradient/outline pairs. */
export const RWA_DETAIL_CTA_HEIGHT_CLASS = "h-[38px] min-h-[38px]";

/** Card detail CTAs — moderate corner radius (not pill). */
export const RWA_DETAIL_BUTTON_FRAME_ROUNDED = "rounded-xl";
export const RWA_DETAIL_BUTTON_RIM_PAD_CLASS = "p-[2px]";
export const RWA_DETAIL_BUTTON_INNER_ROUNDED = "!rounded-[9px]";

/** Buy now / Place bid — frame + inner radius (mobile sticky + desktop sidebar). */
export const RWA_DETAIL_MOBILE_CTA_FRAME_ROUNDED = RWA_DETAIL_BUTTON_FRAME_ROUNDED;
export const RWA_DETAIL_MOBILE_CTA_RIM_PAD_CLASS = RWA_DETAIL_BUTTON_RIM_PAD_CLASS;
export const RWA_DETAIL_MOBILE_CTA_INNER_ROUNDED = RWA_DETAIL_BUTTON_INNER_ROUNDED;
export const RWA_DETAIL_BUY_NOW_TEXT_CLASS = "!text-[#10D333]";
export const RWA_DETAIL_BUY_NOW_FRAME_SHADOW =
  "shadow-[0_0_16px_-10px_rgba(16,211,51,0.22),0_0_24px_-14px_rgba(0,107,107,0.1)] has-[:enabled]:hover:shadow-[0_0_24px_-6px_rgba(16,211,51,0.38),0_0_36px_-10px_rgba(0,107,107,0.16)]";
export const RWA_DETAIL_PLACE_BID_FRAME_SHADOW =
  "shadow-[0_0_20px_-6px_rgba(200,212,222,0.28)] has-[:enabled]:hover:shadow-[0_0_28px_-4px_rgba(220,228,236,0.38)]";

/** Design ref omits external reference + period change on card detail — set true to re-enable. */
export const RWA_DETAIL_SHOW_MARKET_CONTEXT = false;

/** Card detail titles — medium weight (Arial reads heavy at semibold/bold). */
export const RWA_DETAIL_TITLE_WEIGHT_CLASS = "font-medium";
export const RWA_DETAIL_TITLE_CERT_WEIGHT_CLASS = "font-normal";

/** Slab headline muted blue-grey — mobile caption line 1. */
export const RWA_DETAIL_SLAB_TITLE_MUTED_COLOR_CLASS = "text-[#8BA1B3]";
/** Desktop right sidebar — nudge below grid top so title aligns with slab hero. */
export const RWA_DETAIL_DESKTOP_SIDEBAR_TOP_INSET_CLASS = "lg:pt-8";
/** Mobile slab stack — room below header; avoids hero sitting too high in the column. */
export const RWA_DETAIL_MOBILE_SLAB_TOP_INSET_CLASS =
  "max-lg:justify-start max-lg:pt-6 sm:max-lg:pt-8";
/** Desktop right sidebar title — same tone as mobile, smaller than legacy hero sizing. */
export const RWA_DETAIL_DESKTOP_SIDEBAR_TITLE_CLASS = `${RWA_DETAIL_SLAB_TITLE_MUTED_COLOR_CLASS} min-w-0 whitespace-normal break-words text-[15px] ${RWA_DETAIL_TITLE_WEIGHT_CLASS} leading-[1.2] tracking-normal [overflow-wrap:anywhere] sm:text-[16px]`;
export const RWA_DETAIL_DESKTOP_SIDEBAR_CERT_CLASS = `${RWA_DETAIL_TITLE_CERT_WEIGHT_CLASS} tabular-nums text-white`;

/**
 * Mobile RWA hero — scales to parent width; height capped with svh + reserved chrome
 * (header, 3-line caption, sticky CTAs, safe-area) so short / notched devices do not clip.
 */
export const RWA_MOBILE_SLAB_MAX_WIDTH_CLASS = "max-w-[min(100%,480px)]";
/** Mobile card detail — one centered column for slab, sticky CTAs, and modals. */
export const RWA_MOBILE_PAGE_CHANNEL_CLASS = `mx-auto w-full min-w-0 ${RWA_MOBILE_SLAB_MAX_WIDTH_CLASS} px-3 sm:px-4`;
/** Same channel, scoped to mobile breakpoints inside shared desktop layouts. */
export const RWA_MOBILE_PAGE_CHANNEL_MAX_LG_CLASS =
  "max-lg:mx-auto max-lg:w-full max-lg:min-w-0 max-lg:max-w-[min(100%,480px)] max-lg:px-3 sm:max-lg:px-4";
export const RWA_MOBILE_SLAB_MAX_HEIGHT_CLASS =
  "max-h-[min(480px,68svh,calc(100svh-4rem-11.5rem-env(safe-area-inset-bottom,0px)))]";
/** Image + caption column — hugs rendered slab width (not letterboxed container). */
export const RWA_MOBILE_SLAB_STACK_CLASS = `mx-auto flex w-fit min-w-0 ${RWA_MOBILE_SLAB_MAX_WIDTH_CLASS} flex-col items-stretch lg:ml-auto lg:mr-0`;
/** Hero image + caption — caption uses full stack width; image stays centered at intrinsic size. */
export const RWA_MOBILE_SLAB_IMAGE_CAPTION_COLUMN_CLASS =
  "mx-auto flex w-full max-w-full min-w-0 flex-col items-stretch max-lg:shrink-0";
export const RWA_MOBILE_SLAB_HERO_WRAP_CLASS =
  "mx-auto w-fit max-w-full shrink-0";
/** Caption under hero — inset within image column width. */
export const RWA_MOBILE_SLAB_CAPTION_BLOCK_CLASS =
  "w-full shrink-0 px-3 pt-3 pb-3 text-left sm:px-4";
export const RWA_MOBILE_SLAB_CAPTION_LINE_GAP_CLASS = "gap-1.5";
/** Bottom inset above fixed purchase footer (dual CTA + safe-area). */
export const RWA_MOBILE_STICKY_FOOTER_RESERVE_CLASS =
  "max-lg:pb-[calc(6.25rem+env(safe-area-inset-bottom,0px))]";
