/**
 * 레이아웃 셸 — 헤더·본문 공통 `max-w-6xl` + 동일 패딩
 */

/** 헤더·포트폴리오·컬렉션 상세 등 일반 본문 */
export const APP_MAIN_SHELL_CLASS = "max-w-6xl mx-auto px-4 sm:px-6";

/**
 * Wraps routed page content — clips horizontal overflow on mobile so carousels
 * and wide grids do not shift the whole document (“page moves around”).
 */
export const MOBILE_PAGE_SHELL_CLASS =
  "mobile-page-root relative min-w-0 w-full max-w-full overflow-x-clip";

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
