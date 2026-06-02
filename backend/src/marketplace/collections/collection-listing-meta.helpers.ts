/** Pure helpers for IPFS listing metadata (shared by cover + components + collection lifecycle). */

export function cardhedgerFromRwaMetadata(meta: Record<string, unknown>): {
  cardId: string | null;
  searchQuery: string | null;
  psaSpecId: string | null;
} {
  const props = meta.properties as Record<string, unknown> | undefined;
  const graded = (props?.graded ?? meta.graded) as
    | Record<string, unknown>
    | undefined;
  if (!graded || typeof graded !== 'object') {
    return { cardId: null, searchQuery: null, psaSpecId: null };
  }
  const ch = graded.cardhedger as Record<string, unknown> | undefined;
  const cardId =
    typeof ch?.cardId === 'string' && ch.cardId.trim()
      ? ch.cardId.trim()
      : null;
  const searchQuery =
    typeof ch?.searchQuery === 'string' && ch.searchQuery.trim()
      ? ch.searchQuery.trim()
      : null;
  const psa = graded.psa as Record<string, unknown> | undefined;
  const specRaw = psa?.specId ?? psa?.SpecID ?? psa?.spec_id;
  const psaSpecId =
    typeof specRaw === 'number' && Number.isFinite(specRaw)
      ? String(Math.floor(specRaw))
      : typeof specRaw === 'string' && specRaw.trim()
        ? specRaw.trim()
        : null;
  return { cardId, searchQuery, psaSpecId };
}

export function mintVariantFromGradedMeta(meta: Record<string, unknown>): string {
  const props = meta.properties as Record<string, unknown> | undefined;
  const graded = (props?.graded ?? meta.graded) as
    | Record<string, unknown>
    | undefined;
  if (!graded || typeof graded !== 'object') return '';
  const card = graded.card as Record<string, unknown> | undefined;
  return typeof card?.variant === 'string' ? card.variant.trim() : '';
}

export function psaSpecIdFromComponentsRow(comp: unknown): string | null {
  if (!comp || typeof comp !== 'object') return null;
  const o = comp as Record<string, unknown>;
  const raw = o.psaSpecId;
  if (typeof raw === 'number' && Number.isFinite(raw))
    return String(Math.floor(raw));
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return null;
}

export function extractListingDisplayTitleFromMeta(
  meta: Record<string, unknown>,
): string | null {
  const n = meta.name;
  if (typeof n !== 'string') return null;
  const t = n.trim().replace(/\s+/g, ' ');
  return t.length > 0 ? t : null;
}
