import type { MarketplaceCollection } from '../entities/marketplace-collection.entity';

/** Canonical PSA cert — column first; legacy `components.psaCertNumber` read-only fallback. */
export function psaCertNumberFromCollectionRow(
  row: Pick<MarketplaceCollection, 'psaCertNumber' | 'components'>,
): string | null {
  const col = row.psaCertNumber?.trim();
  if (col) return col;
  const legacy = row.components?.psaCertNumber;
  if (typeof legacy === 'string' && legacy.trim()) return legacy.trim();
  return null;
}

/** API/backward-compat: ensure `components.psaCertNumber` mirrors the column when present. */
export function enrichCollectionComponentsForApi(
  components: Record<string, unknown>,
  psaCertNumber: string | null | undefined,
): Record<string, unknown> {
  const cert = psaCertNumber?.trim();
  if (!cert) return components;
  if (String(components.psaCertNumber ?? '').trim() === cert) return components;
  return { ...components, psaCertNumber: cert };
}
