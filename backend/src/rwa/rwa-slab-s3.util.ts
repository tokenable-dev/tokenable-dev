import { joinCatalogCoverPublicUrl } from '../marketplace/collections/catalog-cover-s3.service';

/** Nest under catalog cover prefix — same IAM scope as `user-avatars/`. */
export function deriveRwaSlabS3Prefix(coverPrefix: string): string {
  const p = coverPrefix.endsWith('/') ? coverPrefix : `${coverPrefix}/`;
  return `${p}rwa-slabs/`;
}

export function sanitizeCertForS3Key(certNumber: string): string {
  const digits = certNumber.replace(/\D/g, '');
  return digits.slice(0, 32) || 'unknown';
}

export function stableRwaSlabObjectKey(
  slabPrefix: string,
  chainId: number,
  certNumber: string,
): string {
  const p = slabPrefix.endsWith('/') ? slabPrefix : `${slabPrefix}/`;
  const cert = sanitizeCertForS3Key(certNumber);
  return `${p}${chainId}/${cert}/slab`;
}

export function isPlatformHostedRwaSlabUrl(
  publicUrl: string | null | undefined,
  publicBaseUrl: string,
  slabPrefix: string,
  chainId: number,
  certNumber: string,
): boolean {
  const base = publicBaseUrl.trim().replace(/\/+$/, '');
  if (!base || !publicUrl?.trim()) return false;
  const url = publicUrl.trim().split('?')[0] ?? '';
  if (!url.toLowerCase().startsWith(`${base.toLowerCase()}/`)) return false;
  const key = url.slice(base.length + 1).replace(/^\/+/, '');
  const expected = stableRwaSlabObjectKey(slabPrefix, chainId, certNumber);
  return key.toLowerCase() === expected.toLowerCase();
}

export function publicUrlForRwaSlab(
  publicBaseUrl: string,
  slabPrefix: string,
  chainId: number,
  certNumber: string,
): string {
  return joinCatalogCoverPublicUrl(
    publicBaseUrl,
    stableRwaSlabObjectKey(slabPrefix, chainId, certNumber),
  );
}
