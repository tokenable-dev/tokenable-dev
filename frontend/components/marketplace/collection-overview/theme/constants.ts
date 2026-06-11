import { IBM_Plex_Sans } from "next/font/google";

export const collectionHeroFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const HEADLINE_OUTLINE_TAG =
  "inline-flex h-[26px] min-h-[26px] shrink-0 items-center justify-center rounded border border-[#a2a2a2] bg-transparent px-[10px] py-1 text-sm font-normal leading-none text-white";

export const HEADLINE_OUTLINE_TAG_MOBILE =
  "inline-flex h-[20px] min-h-[20px] shrink-0 items-center justify-center rounded border border-[#a2a2a2] bg-transparent px-2 py-0.5 text-[10px] font-normal leading-none text-white";

export const HEADLINE_NAME_TEXT = "text-[15px] leading-snug tracking-normal";

/** Collection detail title — ~20% below prior headline scale. */
export const HEADLINE_TITLE_ONE_LINE =
  "w-full min-w-0 truncate whitespace-nowrap text-[14.4px] font-bold tracking-tight text-white sm:text-[18px] lg:text-[1.11rem] xl:text-[1.275rem] leading-[1.15]";

export const COLLECTION_HEADLINE_TITLE_CLASS =
  "min-w-0 break-words text-[14.4px] font-bold leading-snug tracking-normal text-white sm:text-[18px] sm:leading-[1.35] lg:text-[21px] lg:leading-[1.4]";

/** Collection detail mobile — design spec: Arial (`globals.css`, not Tailwind arbitrary). */
export const COLLECTION_DETAIL_ARIAL_FONT_CLASS = "collection-detail-mobile-arial";

export const COLLECTION_DETAIL_MOBILE_ARIAL_STYLE = {
  fontFamily: 'Arial, Helvetica, "Helvetica Neue", sans-serif',
  fontWeight: 400,
} as const;

/** Arial reads heavy at bold — match RWA mobile slab (`font-normal`). */
export const COLLECTION_HEADLINE_TITLE_MOBILE_CLASS =
  "collection-detail-mobile-arial text-[clamp(13px,3.6vw,15px)] font-normal leading-[1.2] tracking-normal text-zinc-400";
