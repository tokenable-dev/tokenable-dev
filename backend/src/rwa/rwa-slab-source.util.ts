import { pickRwaAssetDisplayImageRef } from '../marketplace/utils/collection-image.util';

/**
 * Resolve a remote HTTPS URL suitable for S3 slab ingest from mint metadata.
 * Returns null when no usable image source exists (not an error).
 */
export function resolveMintSlabSourceUrl(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const ref = pickRwaAssetDisplayImageRef(metadata);
  if (!ref?.trim()) return null;
  const t = ref.trim();
  if (/^https?:\/\//i.test(t)) return t;
  return null;
}
