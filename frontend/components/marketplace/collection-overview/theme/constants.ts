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

/** Collection detail title — 25% smaller than prior scale (design feedback). */
export const HEADLINE_TITLE_ONE_LINE =
  "w-full min-w-0 truncate whitespace-nowrap text-[18px] font-bold tracking-tight text-white sm:text-[22.5px] lg:text-[1.3875rem] xl:text-[1.59375rem] leading-[1.15]";

export const COLLECTION_HEADLINE_TITLE_CLASS =
  "min-w-0 break-words text-[18px] font-bold leading-snug tracking-normal text-white sm:text-[22.5px] sm:leading-[1.35] lg:text-[26.25px] lg:leading-[1.4]";

export const COLLECTION_HEADLINE_TITLE_MOBILE_CLASS =
  "text-[12.75px] font-bold leading-[1.15] tracking-tight text-white";
