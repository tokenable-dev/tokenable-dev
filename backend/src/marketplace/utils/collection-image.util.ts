function isUsableCoverUrl(s: string): boolean {
  const t = s.trim();
  return (
    /^https?:\/\//i.test(t) || t.startsWith('ipfs://') || t.startsWith('//')
  );
}

/**
 * Normalize protocol-relative URLs (`//cdn.bubble.io/...`) to `https://...`.
 *
 * Some Cardhedger image URLs are returned protocol-relative; `isHighQualityCoverUrl`
 * and external image validators expect an explicit scheme.
 */
export function normalizeImageUrl(s: string): string {
  const t = s.trim();
  return t.startsWith('//') ? `https:${t}` : t;
}

/**
 * 컬렉션 대표 이미지 URL — cert number가 보이지 않는 이미지를 우선합니다.
 * 1) `graded.cardhedger.imageUrl` — Cardhedger 카탈로그 이미지 (슬랩 없음, cert label 없음)
 * 2) `graded.psa.certImageSourceUrl` — PSA 슬랩 사진 원본 (cert label 포함, 최후 수단)
 */
export function extractCollectionRepresentativeImage(
  meta: Record<string, unknown>,
): string | null {
  const props = meta.properties as Record<string, unknown> | undefined;
  const graded = (props?.graded ?? meta.graded) as
    | Record<string, unknown>
    | undefined;
  const ch = graded?.cardhedger as Record<string, unknown> | undefined;
  const chImage =
    typeof ch?.imageUrl === 'string' ? normalizeImageUrl(ch.imageUrl) : '';
  if (chImage && isUsableCoverUrl(chImage)) {
    return chImage;
  }
  const psa = graded?.psa as Record<string, unknown> | undefined;
  const psaCert =
    typeof psa?.certImageSourceUrl === 'string'
      ? psa.certImageSourceUrl.trim()
      : '';
  if (psaCert && isUsableCoverUrl(psaCert)) {
    return psaCert;
  }
  return null;
}

function isDirectHttpsImageUrl(s: string): boolean {
  const t = s.trim();
  return /^https?:\/\//i.test(t) && !t.toLowerCase().includes('/ipfs/');
}

/**
 * RWA 카드 히어로/리스트용 이미지 ref — 민트 구조는 그대로 두고, 응답 `imageUrl`만 빠르게 만든다.
 * 순서: (1) PSA `certImageSourceUrl`·Cardhedger `imageUrl` 중 **순수 HTTPS**(IPFS 경로 제외)
 * → (2) {@link extractCollectionRepresentativeImage} (Cardhedger·PSA cert fallback)
 * → (3) 표준 `image`(보통 ipfs://).
 */
export function pickRwaAssetDisplayImageRef(
  meta: Record<string, unknown>,
): string | undefined {
  const props = meta.properties as Record<string, unknown> | undefined;
  const graded = (props?.graded ?? meta.graded) as
    | Record<string, unknown>
    | undefined;
  const psa = graded?.psa as Record<string, unknown> | undefined;
  const cert =
    typeof psa?.certImageSourceUrl === 'string'
      ? psa.certImageSourceUrl.trim()
      : '';
  if (cert && isUsableCoverUrl(cert) && isDirectHttpsImageUrl(cert)) {
    return cert;
  }
  const ch = graded?.cardhedger as Record<string, unknown> | undefined;
  const chImage = typeof ch?.imageUrl === 'string' ? ch.imageUrl.trim() : '';
  if (chImage && isUsableCoverUrl(chImage) && isDirectHttpsImageUrl(chImage)) {
    return chImage;
  }

  const rep = extractCollectionRepresentativeImage(meta);
  if (rep) return rep;

  const img = meta.image;
  return typeof img === 'string' && img.trim() ? img.trim() : undefined;
}

/**
 * Trending / listing 카드용: **슬랩 전체(인증 라벨 포함)**에 가까운 URL 우선.
 * 순서: PSA 슬랩 원본 URL → Cardhedger → 민트 `image`(ipfs) → {@link extractCollectionRepresentativeImage}.
 */
export function pickTrendingSlabImageRef(
  meta: Record<string, unknown>,
): string | null {
  const props = meta.properties as Record<string, unknown> | undefined;
  const graded = (props?.graded ?? meta.graded) as
    | Record<string, unknown>
    | undefined;
  const psa = graded?.psa as Record<string, unknown> | undefined;
  const cert =
    typeof psa?.certImageSourceUrl === 'string'
      ? psa.certImageSourceUrl.trim()
      : '';
  if (cert && isUsableCoverUrl(cert)) {
    return cert;
  }
  const ch = graded?.cardhedger as Record<string, unknown> | undefined;
  const chImage = typeof ch?.imageUrl === 'string' ? ch.imageUrl.trim() : '';
  if (chImage && isUsableCoverUrl(chImage)) {
    return chImage;
  }
  const img = meta.image;
  if (typeof img === 'string' && img.trim()) {
    return img.trim();
  }
  return extractCollectionRepresentativeImage(meta);
}

/** @deprecated Legacy normalized cover API — migrate to direct HTTPS URLs. */
export function isLegacyNormalizedCollectionCoverApiPath(
  url: string | null | undefined,
): boolean {
  const t = (url ?? '').trim();
  return /\/marketplace\/collections\/[^/?#]+\/cover-image\.jpg$/i.test(t);
}

export function isPsaCertSlabCloudfrontUrl(url: string): boolean {
  return url.includes('d1htnxwo4o0jhw.cloudfront.net/cert/');
}

/**
 * UI display URL for collection cards (list, carousel, detail hero).
 * Uses marketplace_collections.cover_image_url only.
 */
export function pickCollectionDisplayImageUrl(
  coverImageUrl: string | null | undefined,
): string | null {
  const cover = coverImageUrl?.trim() ?? '';
  if (!cover) return null;
  if (isPsaCertSlabCloudfrontUrl(cover)) return null;
  if (isLegacyNormalizedCollectionCoverApiPath(cover)) return null;
  return cover;
}

/** 메타 `graded.psa.certNumber` — Trending 풀 정렬·필터용 */
export function psaCertNumberFromGradedMeta(
  meta: Record<string, unknown>,
): string | undefined {
  const props = meta.properties as Record<string, unknown> | undefined;
  const graded = (props?.graded ?? meta.graded) as
    | Record<string, unknown>
    | undefined;
  const psa = graded?.psa as Record<string, unknown> | undefined;
  const raw = psa?.certNumber;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t.length > 0) return t;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return String(raw);
  }
  return undefined;
}
