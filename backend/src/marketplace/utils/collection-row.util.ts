import type { MarketplaceCollection } from '../entities/marketplace-collection.entity';

/** Digits-only key so `71203344` and formatting variants compare equal. */
export function normalizePsaCertDigits(cert: string): string {
  return cert.replace(/\D/g, '');
}

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

export type ListingPsaCertHit = {
  cert: string;
  /** Ask USDC micros — used to pick floor when multiple certs exist. */
  considerationAmount: string;
};

/**
 * Collection buckets often have many slabs → many PSA certs. Pick one
 * representative for `marketplace_collections.psa_cert_number`:
 * 1. Keep `current` when it is still among active listing certs (stable).
 * 2. Else use the lowest-ask (floor) listing's cert.
 */
export function pickCollectionPsaCertNumber(
  hits: ListingPsaCertHit[],
  current: string | null | undefined,
): string | null {
  if (hits.length === 0) return null;

  const byDigits = new Map<string, string>();
  for (const h of hits) {
    const raw = h.cert.trim();
    const d = normalizePsaCertDigits(raw);
    if (!d) continue;
    if (!byDigits.has(d)) byDigits.set(d, raw);
  }
  if (byDigits.size === 0) return null;

  const cur = (current ?? '').trim();
  const curD = normalizePsaCertDigits(cur);
  if (curD && byDigits.has(curD)) return byDigits.get(curD)!;

  const sorted = [...hits].sort((a, b) => {
    try {
      const aa = BigInt(a.considerationAmount || '0');
      const bb = BigInt(b.considerationAmount || '0');
      if (aa === bb) return 0;
      return aa < bb ? -1 : 1;
    } catch {
      return 0;
    }
  });
  const floorRaw = sorted[0]!.cert.trim();
  const floorD = normalizePsaCertDigits(floorRaw);
  return floorD ? (byDigits.get(floorD) ?? floorRaw) : floorRaw;
}
