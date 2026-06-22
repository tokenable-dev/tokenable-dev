import type { CSSProperties } from "react";

/**
 * Cardhedger Bubble CDN `/resize` assets are narrower than standard TCG art.
 * Stretch width only in collection cover UI (see {@link collectionCoverImageStyle}).
 */
export const CARDHEDGER_BUBBLE_RESIZE_SCALE_X = 1.24;

/** Path ends with `/resize` on Bubble CDN — not `resized_*.jpeg` or `/crop_image`. */
export function isCardhedgerBubbleResizeUrl(
  url: string | null | undefined,
): boolean {
  if (!url?.trim()) return false;
  try {
    const normalized = url.trim().startsWith("//")
      ? `https:${url.trim()}`
      : url.trim();
    const { pathname, hostname } = new URL(normalized);
    if (!hostname.includes("cdn.bubble.io")) return false;
    return /\/resize$/i.test(pathname);
  } catch {
    return false;
  }
}

const COVER_IMAGE_FILTER: CSSProperties = {
  filter: "saturate(1.04) contrast(1.02)",
};

/** Shared cover `<img>` style — applies horizontal stretch for narrow `/resize` URLs. */
export function collectionCoverImageStyle(
  url: string | null | undefined,
): CSSProperties {
  if (!isCardhedgerBubbleResizeUrl(url)) {
    return COVER_IMAGE_FILTER;
  }
  return {
    ...COVER_IMAGE_FILTER,
    transform: `scaleX(${CARDHEDGER_BUBBLE_RESIZE_SCALE_X})`,
    transformOrigin: "center",
  };
}
