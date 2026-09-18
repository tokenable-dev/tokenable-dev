/**
 * Public CDN/S3 base for catalog covers (no trailing slash).
 * Prefer backend-normalized cover URLs from the collections API; this is a
 * client-side hint for WebGL same-origin proxying.
 */
export function catalogCoverPublicBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_CATALOG_COVER_PUBLIC_BASE_URL ?? "")
    .trim()
    .replace(/\/+$/, "");
}

/**
 * Stable object keys end with `/cover`. Older rows sometimes omit that suffix
 * (S3 returns 403 for the folder key).
 */
export function normalizeCatalogCoverPublicUrl(
  url: string | null | undefined,
): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  try {
    const normalized = raw.startsWith("//") ? `https:${raw}` : raw;
    const u = new URL(normalized);
    if (/\/cover$/i.test(u.pathname)) return u.toString();
    if (/\/covers\/[^/]+$/i.test(u.pathname)) {
      u.pathname = `${u.pathname.replace(/\/+$/, "")}/cover`;
      return u.toString();
    }
  } catch {
    /* keep */
  }
  return raw;
}

/**
 * True when the URL is a catalog cover on our S3/CloudFront public base
 * (or looks like `{…}/covers/{key}/cover`).
 */
export function isCatalogCoverS3Url(url: string | null | undefined): boolean {
  const raw = normalizeCatalogCoverPublicUrl(url);
  if (!raw) return false;

  const base = catalogCoverPublicBaseUrl();
  if (base && raw.toLowerCase().startsWith(`${base.toLowerCase()}/`)) {
    return true;
  }

  try {
    const u = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
    if (u.pathname.toLowerCase().includes("/cert/")) return false;
    if (!/\/covers\/[^/]+\/cover$/i.test(u.pathname)) return false;
    const host = u.hostname.toLowerCase();
    return (
      host.endsWith(".amazonaws.com") ||
      host.endsWith(".cloudfront.net") ||
      host.includes("s3.")
    );
  } catch {
    return false;
  }
}

/** `next/image` optimizer — HTTPS catalog covers on S3/CloudFront only. */
export function isNextImageCatalogCoverUrl(url: string | null | undefined): boolean {
  const raw = normalizeCatalogCoverPublicUrl(url);
  if (!raw || !isCatalogCoverS3Url(raw)) return false;
  try {
    const u = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Same-origin proxy URL so WebGL TextureLoader (crossOrigin=anonymous) can
 * decode catalog covers when the S3 bucket has no CORS rules.
 */
export function toSameOriginCatalogCoverUrl(url: string): string {
  const normalized = normalizeCatalogCoverPublicUrl(url);
  if (!normalized || !isCatalogCoverS3Url(normalized)) {
    return normalized ?? url;
  }
  return `/api/marketplace/catalog-covers/asset?src=${encodeURIComponent(normalized)}`;
}
