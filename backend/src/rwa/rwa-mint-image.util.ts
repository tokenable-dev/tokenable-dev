import {
  isHttpOrHttpsUrl,
  isPsaCertSlabCloudfrontUrl,
  normalizeImageUrl,
  scoreCollectionCoverUrl,
} from '../marketplace/utils/collection-image.util';

export type MintImageSource =
  | 'psa_cert'
  | 'user_upload'
  | 'cardhedger_catalog'
  | 'tokenable_placeholder';

const CARDHEDGER_PLACEHOLDER_PATH_RE =
  /(?:card[_-]?hedge(?:r)?[_-]?(?:logo|default|placeholder)|default[_-]?card|no[_-]?image|missing[_-]?image|placeholder[_-]?card)/i;

/** Cardhedger returns a branded generic card when catalog art is missing — never mint this. */
export function isCardhedgerBrandedPlaceholderUrl(
  url: string | null | undefined,
): boolean {
  if (!url?.trim()) return false;
  const t = normalizeImageUrl(url.trim());
  try {
    const { pathname, hostname } = new URL(t);
    const path = decodeURIComponent(pathname).toLowerCase();
    const host = hostname.toLowerCase();
    if (CARDHEDGER_PLACEHOLDER_PATH_RE.test(path)) return true;
    if (host.includes('cardhedger') && /(?:logo|placeholder|default)/i.test(path)) {
      return true;
    }
    if (host.includes('cdn.bubble.io') && /card[_-]?hedge/i.test(path)) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function isUsableCardhedgerMintImageUrl(
  url: string | null | undefined,
): boolean {
  if (!url?.trim()) return false;
  const t = normalizeImageUrl(url.trim());
  if (!isHttpOrHttpsUrl(t)) return false;
  if (isPsaCertSlabCloudfrontUrl(t)) return false;
  if (/\/rwa-slabs\//i.test(t)) return false;
  if (isCardhedgerBrandedPlaceholderUrl(t)) return false;
  if (scoreCollectionCoverUrl(t) < 55) return false;
  return true;
}

export function resolveCardhedgerMintImageUrl(input: {
  imageUrl?: string | null;
}): string | null {
  const raw = input.imageUrl?.trim();
  if (!raw || !isUsableCardhedgerMintImageUrl(raw)) return null;
  return normalizeImageUrl(raw);
}

/**
 * Remote mint image priority (file upload handled separately):
 * PSA slab → user/submission URL → Cardhedger catalog → none (caller uses Tokenable placeholder).
 */
export function resolveRemoteMintImageUrl(input: {
  psaCertSlabUrl?: string | null;
  userImageUrl?: string | null;
  cardhedgerImageUrl?: string | null;
}): { url: string | null; source: MintImageSource | null } {
  const psa = input.psaCertSlabUrl?.trim() || '';
  if (psa && isHttpOrHttpsUrl(psa)) {
    return { url: normalizeImageUrl(psa), source: 'psa_cert' };
  }

  const remote = input.userImageUrl?.trim() || '';
  if (remote && isPsaCertSlabCloudfrontUrl(remote)) {
    return { url: remote, source: 'psa_cert' };
  }

  const cardhedgerFromMeta = resolveCardhedgerMintImageUrl({
    imageUrl: input.cardhedgerImageUrl,
  });
  const cardhedgerFromRemote = resolveCardhedgerMintImageUrl({
    imageUrl: remote,
  });

  if (
    remote &&
    !cardhedgerFromRemote &&
    !isCardhedgerBrandedPlaceholderUrl(remote)
  ) {
    return { url: remote, source: 'user_upload' };
  }

  if (cardhedgerFromRemote) {
    return { url: cardhedgerFromRemote, source: 'cardhedger_catalog' };
  }
  if (cardhedgerFromMeta) {
    return { url: cardhedgerFromMeta, source: 'cardhedger_catalog' };
  }

  return { url: null, source: null };
}

export function readPsaCertSlabUrlFromGraded(
  graded: Record<string, unknown> | undefined,
): string | null {
  if (!graded || typeof graded !== 'object') return null;
  const psa = graded.psa as Record<string, unknown> | undefined;
  const cert =
    typeof psa?.certImageSourceUrl === 'string'
      ? psa.certImageSourceUrl.trim()
      : '';
  if (cert && isPsaCertSlabCloudfrontUrl(cert)) return cert;
  return null;
}

export function readPsaCertBackUrlFromGraded(
  graded: Record<string, unknown> | undefined,
): string | null {
  if (!graded || typeof graded !== 'object') return null;
  const psa = graded.psa as Record<string, unknown> | undefined;
  const fromPsa =
    typeof psa?.certImageBackUrl === 'string' ? psa.certImageBackUrl.trim() : '';
  const verification = graded.verification as Record<string, unknown> | undefined;
  const fromVer =
    typeof verification?.slabBack === 'string'
      ? verification.slabBack.trim()
      : '';
  const raw = fromPsa || fromVer;
  if (!isHttpOrHttpsUrl(raw)) return null;
  if (isCardhedgerBrandedPlaceholderUrl(raw)) return null;
  return normalizeImageUrl(raw);
}

export function readCardhedgerMintImageUrlFromGraded(
  graded: Record<string, unknown> | undefined,
): string | null {
  if (!graded || typeof graded !== 'object') return null;
  const ch = graded.cardhedger as Record<string, unknown> | undefined;
  return resolveCardhedgerMintImageUrl({
    imageUrl: typeof ch?.imageUrl === 'string' ? ch.imageUrl : null,
  });
}
