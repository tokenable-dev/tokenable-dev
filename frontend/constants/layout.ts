/**
 * 레이아웃 셸
 * - 기본: 헤더·대부분 페이지 — `max-w-6xl`(최초 기준과 동일)
 * - 컬렉션 상세만: 차트·오더북 등 밀도를 위해 넓은 캔버스 유지
 */

/** 헤더·포트폴리오 등 일반 본문 (초기 `max-w-6xl` + 동일 패딩) */
export const APP_MAIN_SHELL_CLASS = "max-w-6xl mx-auto px-4 sm:px-6";

/** `/marketplace/collections/[collectionKey]` 전용 */
export const COLLECTION_DETAIL_SHELL_CLASS =
  "mx-auto w-full max-w-[1680px] px-3 min-[375px]:px-4 sm:px-5 lg:px-8 xl:px-10";

/** 컬렉션 상세(넓은 셸)·헤더 정렬 동기화용 */
export function isMarketplaceCollectionDetailPath(
  pathname: string | null | undefined,
): boolean {
  if (!pathname) return false;
  const m = pathname.match(/^\/marketplace\/collections\/([^/]+)/);
  return !!m?.[1];
}
