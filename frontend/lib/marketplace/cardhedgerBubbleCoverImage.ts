import type { CSSProperties } from "react";

/** Protocol-relative Bubble CDN URLs → https. */
export function resolveCardhedgerImageUrl(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith("//")) return `https:${raw}`;
  return raw;
}

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
  filter: "saturate(1.05) contrast(1.04)",
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

/**
 * Prefer Cardhedger Bubble catalog art (`/crop_image`, `/resize`) — raw card scans,
 * not eBay graded slab photos. Used when scoring a known URL (e.g. mint source),
 * not for ungated client card-search cover picks.
 */
export function scoreCardhedgerCatalogCoverUrl(url: string | null | undefined): number {
  const u = resolveCardhedgerImageUrl(url ?? null);
  if (!u) return -1;
  try {
    const { hostname, pathname } = new URL(u);
    const host = hostname.toLowerCase();
    if (host.includes("ebayimg.com") || host.includes("ebay.com")) return -1;
    if (host.includes("cloudfront.net") && u.includes("/cert/")) return -1;
    if (host.includes("cdn.bubble.io")) {
      if (/\/crop_image$/i.test(pathname)) return 100;
      if (/\/resize$/i.test(pathname)) return 90;
      return 70;
    }
    return 10;
  } catch {
    return -1;
  }
}
