/**
 * Raster category / index icons ship at mixed native sizes (e.g. 16–32px).
 * Wrap in a fixed box so UI alignment stays consistent.
 */
export const MARKET_RASTER_ICON_FRAME =
  "flex h-9 w-9 shrink-0 items-center justify-center sm:h-10 sm:w-10";

/** Always monochrome — source PNGs may still carry color; CSS strips it. */
export const MARKET_RASTER_ICON_IMG =
  "max-h-[1.75rem] max-w-[1.75rem] object-contain object-center grayscale saturate-0 sm:max-h-8 sm:max-w-8";

/** NBA ball asset reads slightly larger at equal max-* — tighten only for that icon. */
export const MARKET_RASTER_ICON_IMG_NBA =
  "max-h-[1.42rem] max-w-[1.42rem] object-contain object-center grayscale saturate-0 sm:max-h-[1.62rem] sm:max-w-[1.62rem]";
