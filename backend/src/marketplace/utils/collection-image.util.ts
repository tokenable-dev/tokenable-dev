function isUsableCoverUrl(s: string): boolean {
  const t = s.trim();
  return /^https?:\/\//i.test(t) || t.startsWith('ipfs://');
}

/**
 * 컬렉션 대표 이미지 URL.
 * 1) `graded.collectionCoverImage` — 민팅 시 서버가 PSA 슬랩 상단 라벨·베젤을 크롭해 올린 IPFS 이미지
 * 2) `graded.psa.certImageSourceUrl` — 민팅 시 기록한 PSA 슬랩 사진 원본 URL
 * 3) `graded.cardhedger.imageUrl`
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
  const ch = graded?.cardhedger as Record<string, unknown> | undefined;
  const chImage = typeof ch?.imageUrl === 'string' ? ch.imageUrl.trim() : '';
  if (chImage && isUsableCoverUrl(chImage)) {
    return chImage;
  }
  return null;
}
