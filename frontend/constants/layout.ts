/**
 * 레이아웃 셸 — 헤더·본문 공통 max-width 1240px + prototype padding
 */

/** 헤더·포트폴리오·컬렉션 상세 등 일반 본문 */
export const APP_MAIN_SHELL_CLASS = "tkl-wrap";

/**
 * Wraps routed page content on mobile. Horizontal overflow is contained on
 * `html`/`body` (see globals.css); avoid `overflow-x: clip` here so flex
 * children are not height-clipped.
 */
export const MOBILE_PAGE_SHELL_CLASS =
  "mobile-page-root relative min-w-0 w-full max-w-full";

/** `/marketplace/collections/[collectionKey]` — 헤더·본문 정렬용 (일반 셸과 동일) */
export const COLLECTION_DETAIL_SHELL_CLASS = APP_MAIN_SHELL_CLASS;

/** 컬렉션 상세·헤더 정렬 동기화용 */
export function isMarketplaceCollectionDetailPath(
  pathname: string | null | undefined,
): boolean {
  if (!pathname) return false;
  const m = pathname.match(/^\/marketplace\/collections\/([^/]+)/);
  return !!m?.[1];
}
