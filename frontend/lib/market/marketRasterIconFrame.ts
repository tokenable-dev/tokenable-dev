/**
 * Raster category / index icons ship at mixed native sizes (e.g. 16–32px).
 * Wrap in a fixed box so UI alignment stays consistent.
 */
const MARKET_RASTER_ICON_IMG_SIZE =
  "max-h-[1.75rem] max-w-[1.75rem] object-contain object-center sm:max-h-8 sm:max-w-8";

/** Inactive category chips — monochrome until selected or hovered. */
export const MARKET_RASTER_ICON_IMG = `${MARKET_RASTER_ICON_IMG_SIZE} grayscale saturate-0`;

/** Selected / active category chip — full-color icon. */
export const MARKET_RASTER_ICON_IMG_ACTIVE = `${MARKET_RASTER_ICON_IMG_SIZE} grayscale-0 saturate-100`;

const MARKET_RASTER_ICON_IMG_NBA_SIZE =
  "max-h-[1.42rem] max-w-[1.42rem] object-contain object-center sm:max-h-[1.62rem] sm:max-w-[1.62rem]";

export const MARKET_RASTER_ICON_IMG_NBA = `${MARKET_RASTER_ICON_IMG_NBA_SIZE} grayscale saturate-0`;

export const MARKET_RASTER_ICON_IMG_NBA_ACTIVE = `${MARKET_RASTER_ICON_IMG_NBA_SIZE} grayscale-0 saturate-100`;
