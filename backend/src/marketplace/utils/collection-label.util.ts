import type { MarketBucketComponents } from './bucket-key.util';

/**
 * Mint / PSA 분석 후 `properties.graded.cardhedger.searchQuery`에 들어가는 검색문.
 * 있으면 컬렉션 표시명 후보로 쓰며, {@link buildCollectionDisplayLabel}에서 등급 구문은 제거한다.
 */
export function extractCollectionQueryUsed(
  meta: Record<string, unknown>,
): string | null {
  const props = meta.properties as Record<string, unknown> | undefined;
  const graded = (props?.graded ?? meta.graded) as
    | Record<string, unknown>
    | undefined;
  if (!graded || typeof graded !== 'object') return null;
  const ch = graded.cardhedger as Record<string, unknown> | undefined;
  if (!ch || typeof ch !== 'object') return null;
  const q = ch.searchQuery;
  if (typeof q !== 'string' || !q.trim()) return null;
  return q.trim().replace(/\s+/g, ' ');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `card.set` → `card.name` 순; 등급/회사 문자열 없음 — 버킷 키는 그대로 `components`. */
function gradeFreeLabelPartsFromComponents(
  components: MarketBucketComponents,
): string {
  const set = (components.cardSetDisplay ?? components.cardSet).trim();
  const name = (components.cardNameDisplay ?? components.cardName).trim();
  const year =
    typeof components.year === 'number' &&
    Number.isFinite(components.year) &&
    components.year >= 1880 &&
    components.year <= 2100
      ? String(Math.trunc(components.year))
      : '';
  return [year, set, name].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * 본문에서 `gradingCompany gradeScore`(단어 단위·대소문자 무관) 및 `CMP-10` 형 변형만 제거.
 */
function stripGradingCompanyAndScoreFromText(
  text: string,
  components: MarketBucketComponents,
): string {
  const company = components.gradingCompany.trim();
  const grade = components.gradeScore.trim();
  if (!company || !grade || !text.trim()) return text.trim();

  const co = escapeRegExp(company);
  const gr = escapeRegExp(grade);
  const patterns = [
    new RegExp(`\\b${co}\\s+${gr}\\b`, 'gi'),
    new RegExp(`\\b${co}\\s*[-–]\\s*${gr}\\b`, 'gi'),
  ];
  let s = text;
  for (const re of patterns) s = s.replace(re, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * 컬렉션 표시용: 카드 라인만 쓴다(등급사·점수 라벨 제외).
 * `queryUsed`(Cardhedger 검색문)가 있으면 그중 본 버킷 등급 구문만 제거한 뒤 남는 문구를 쓰고,
 * 비면 `cardSet` + `cardName` 조합으로 만든다.
 */
export function buildCollectionDisplayLabel(
  components: MarketBucketComponents,
  queryUsed: string | null,
): string {
  const base = gradeFreeLabelPartsFromComponents(components);
  if (!queryUsed || !queryUsed.trim()) return base;

  const stripped = stripGradingCompanyAndScoreFromText(
    queryUsed.trim(),
    components,
  );
  return stripped.length > 0 ? stripped : base;
}
