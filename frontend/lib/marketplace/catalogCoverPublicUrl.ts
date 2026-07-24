/**
 * Public CDN base for catalog covers (no trailing slash).
 */
export function catalogCoverPublicBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_CATALOG_COVER_PUBLIC_BASE_URL ?? "")
    .trim()
    .replace(/\/+$/, "");
}
