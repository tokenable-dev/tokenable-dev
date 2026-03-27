import type { MarketBucketComponents } from './bucket-key.util';

/**
 * Mint / PSA 분석 후 `properties.graded.justtcg.queryUsed`에 들어가는 JustTCG 검색문.
 * 있으면 컬렉션 표시명으로 우선 사용한다.
 */
export function extractJustTcgQueryUsed(
  meta: Record<string, unknown>,
): string | null {
  const props = meta.properties as Record<string, unknown> | undefined;
  const graded = (props?.graded ?? meta.graded) as Record<string, unknown> | undefined;
  if (!graded || typeof graded !== 'object') return null;
  const jt = graded.justtcg as Record<string, unknown> | undefined;
  if (!jt || typeof jt !== 'object') return null;
  const q = jt.queryUsed;
  if (typeof q !== 'string' || !q.trim()) return null;
  return q.trim().replace(/\s+/g, ' ');
}

/**
 * queryUsed 없을 때: "이름 + 업체 + 등급" (사용자 예: PIKACHU/GREY FELT HAT PSA 9)
 * components.cardName 은 bucket 정규화(lower) 상태이므로 표시용은 단어 경계만 살린 타이틀 느낌으로.
 */
export function buildCollectionDisplayLabel(
  components: MarketBucketComponents,
  queryUsed: string | null,
): string {
  if (queryUsed && queryUsed.trim()) return queryUsed.trim();

  const name = components.cardName.trim();
  const company = components.gradingCompany.trim().toUpperCase();
  const g = components.gradeScore.trim();
  const parts = [name, company, g].filter(Boolean);
  return parts.join(' ');
}
