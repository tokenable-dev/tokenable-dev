/**
 * 컬렉션 대표 이미지 — RWA 메타데이터 루트 `image`(슬랩 사진) 대신 JustTCG 카드 아트만 사용.
 *
 * JustTCG v1 Card 객체는 문서/예시에 이미지 필드가 없고 `tcgplayerId`만 오는 경우가 많음 →
 * 숫자 product id가 있으면 TCGPlayer CDN URL을 조합한다 (카탈로그 일러스트).
 */
function tcgplayerProductImageUrl(tcgplayerId: unknown): string | null {
  const raw =
    typeof tcgplayerId === 'number'
      ? String(Math.trunc(tcgplayerId))
      : typeof tcgplayerId === 'string'
        ? tcgplayerId.trim()
        : '';
  if (!/^\d+$/.test(raw)) return null;
  return `https://tcgplayer-cdn.tcgplayer.com/product/${raw}_200w.jpg`;
}

/**
 * IPFS `topMatch` 또는 JustTCG `/cards` 응답의 카드 객체 공통 처리.
 * (API는 이미지 URL을 안 주고 tcgplayerId만 주는 경우가 많음 → TCGPlayer CDN 조합)
 */
export function extractCoverFromJustTcgCardLike(
  card: Record<string, unknown> | null | undefined,
): string | null {
  if (!card || typeof card !== 'object') return null;
  for (const k of ['image', 'imageUrl', 'thumbnailUrl', 'smallImage']) {
    const v = card[k];
    if (typeof v === 'string' && /^https?:\/\//i.test(v)) return v;
  }
  const nested = card.card as Record<string, unknown> | undefined;
  if (nested && typeof nested === 'object') {
    for (const k of ['image', 'imageUrl', 'thumbnailUrl']) {
      const v = nested[k];
      if (typeof v === 'string' && /^https?:\/\//i.test(v)) return v;
    }
  }
  const fromTcg = tcgplayerProductImageUrl(card.tcgplayerId);
  if (fromTcg) return fromTcg;
  return null;
}

/** JustTCG lookups from mint metadata `graded.justtcg.topMatch`. */
export interface JustTcgProductIdentifiers {
  cardId: string | null;
  tcgplayerId: string | null;
  variantId: string | null;
}

function stringSlugFromCardLike(top: Record<string, unknown>): string | null {
  for (const key of ['id', 'cardId']) {
    const v = top[key];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return null;
}

function tcgplayerIdFromCardLike(top: Record<string, unknown>): string | null {
  const v = top.tcgplayerId;
  if (typeof v === 'number' && Number.isFinite(v)) return String(Math.trunc(v));
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return v.trim();
  return null;
}

function variantIdFromCardLike(top: Record<string, unknown>): string | null {
  const v = top.variantId;
  if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  return null;
}

export function extractJustTcgProductIdentifiersFromMetadata(
  meta: Record<string, unknown>,
): JustTcgProductIdentifiers {
  const props = meta.properties as Record<string, unknown> | undefined;
  const graded = (props?.graded ?? meta.graded) as Record<string, unknown> | undefined;
  const jt = graded?.justtcg as Record<string, unknown> | undefined;
  const top = jt?.topMatch;
  if (!top || typeof top !== 'object') {
    return { cardId: null, tcgplayerId: null, variantId: null };
  }
  const t = top as Record<string, unknown>;
  return {
    cardId: stringSlugFromCardLike(t),
    tcgplayerId: tcgplayerIdFromCardLike(t),
    variantId: variantIdFromCardLike(t),
  };
}

/**
 * Mint-time JustTCG card slug (`id` / `cardId` on topMatch).
 */
export function extractJustTcgCardIdFromMetadata(meta: Record<string, unknown>): string | null {
  return extractJustTcgProductIdentifiersFromMetadata(meta).cardId;
}


/**
 * 컬렉션 대표 이미지 — RWA 메타데이터 루트 `image`(슬랩 사진) 대신 JustTCG 카드 아트만 사용.
 */
export function extractJustTcgRepresentativeImage(
  meta: Record<string, unknown>,
): string | null {
  const props = meta.properties as Record<string, unknown> | undefined;
  const graded = (props?.graded ?? meta.graded) as Record<string, unknown> | undefined;
  const jt = graded?.justtcg as Record<string, unknown> | undefined;
  const top = jt?.topMatch;
  if (!top || typeof top !== 'object') return null;
  return extractCoverFromJustTcgCardLike(top as Record<string, unknown>);
}

function isUsableCoverUrl(s: string): boolean {
  const t = s.trim();
  return /^https?:\/\//i.test(t) || t.startsWith('ipfs://');
}

/**
 * 컬렉션 대표 이미지 URL.
 * 1) `graded.collectionCoverImage` — 민팅 시 서버가 PSA 슬랩 상단 라벨·베젤을 크롭해 올린 IPFS 이미지
 * 2) `graded.psa.certImageSourceUrl` — 민팅 시 기록한 PSA 슬랩 사진 원본 URL
 * 3) JustTCG topMatch / tcgplayerId
 */
export function extractCollectionRepresentativeImage(
  meta: Record<string, unknown>,
): string | null {
  const props = meta.properties as Record<string, unknown> | undefined;
  const graded = (props?.graded ?? meta.graded) as Record<string, unknown> | undefined;
  const explicit = graded?.collectionCoverImage;
  if (typeof explicit === 'string' && isUsableCoverUrl(explicit)) {
    return explicit.trim();
  }
  const psa = graded?.psa as Record<string, unknown> | undefined;
  const psaCert = typeof psa?.certImageSourceUrl === 'string' ? psa.certImageSourceUrl.trim() : '';
  if (psaCert && isUsableCoverUrl(psaCert)) {
    return psaCert;
  }
  return extractJustTcgRepresentativeImage(meta);
}
