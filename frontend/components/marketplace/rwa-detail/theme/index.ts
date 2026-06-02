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
