import { createHash } from 'crypto';

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

/**
 * PSA slab / OCR often prefixes full-art etc. PokeTrace catalog names usually omit these.
 * e.g. "FA/MEWTWO VSTAR" → "MEWTWO VSTAR"
 */
export function normalizePsaCardNameForPoketrace(name: string): string {
  return name
    .trim()
    .replace(/^(FA\/|GG\/|TG\/|CSR\/|SR\/)/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Secret rares use "086/078"; APIs often store "086" only — use leading segment for matching.
 */
export function primaryCardNumberForPoketrace(num: string): string {
  const t = num.replace(/^#/, '').trim();
  if (!t) return '';
  return t.split('/')[0].trim();
}

/** Light cleanup on full JustTCG / manual query strings */
export function normalizePoketraceSearchQueryString(q: string): string {
  return q
    .replace(/\b(FA|GG|TG|CSR|SR)\//gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Derive PokeTrace search text + scoring hints from RWA IPFS JSON (mint `properties.graded`).
 * Mirrors frontend vault mint: prefer JustTCG `queryUsed`, else PSA/card fields.
 */
export function buildPoketraceQueryFromRwaMetadata(metadata: unknown): {
  query: string;
  cardName: string;
  cardNumber: string;
  /** Mint-time PokeTrace catalog id — skip blind search when present */
  poketraceCardId: string | null;
  poketraceSearchQuery: string | null;
} {
  if (!isRecord(metadata)) {
    return {
      query: '',
      cardName: '',
      cardNumber: '',
      poketraceCardId: null,
      poketraceSearchQuery: null,
    };
  }

  const props = metadata.properties;
  const graded = isRecord(props) && isRecord(props.graded) ? props.graded : null;

  const poketraceMeta =
    graded && isRecord(graded.poketrace) ? graded.poketrace : null;
  const poketraceCardId =
    typeof poketraceMeta?.cardId === 'string' && poketraceMeta.cardId.trim()
      ? poketraceMeta.cardId.trim()
      : null;
  const poketraceSearchQueryStored =
    typeof poketraceMeta?.searchQuery === 'string' && poketraceMeta.searchQuery.trim()
      ? poketraceMeta.searchQuery.trim()
      : null;

  const justtcg = graded && isRecord(graded.justtcg) ? graded.justtcg : null;
  const qFromJt =
    typeof justtcg?.queryUsed === 'string' ? justtcg.queryUsed.trim() : '';

  const psa = graded && isRecord(graded.psa) ? graded.psa : null;
  const card = graded && isRecord(graded.card) ? graded.card : null;

  const cardNameRaw =
    (typeof psa?.cardNameHint === 'string' && psa.cardNameHint.trim()) ||
    (typeof card?.name === 'string' && card.name.trim()) ||
    (typeof metadata.name === 'string' && metadata.name.trim()) ||
    '';

  const cardNumberRaw =
    (typeof psa?.cardNumberHint === 'string' && psa.cardNumberHint.trim()) ||
    (card?.number != null ? String(card.number).trim() : '') ||
    '';

  const cardName = normalizePsaCardNameForPoketrace(cardNameRaw) || cardNameRaw;
  const cardNumber =
    primaryCardNumberForPoketrace(cardNumberRaw) || cardNumberRaw.replace(/^#/, '');

  if (qFromJt) {
    const query = normalizePoketraceSearchQueryString(qFromJt) || qFromJt.trim();
    return {
      query,
      cardName,
      cardNumber,
      poketraceCardId,
      poketraceSearchQuery: poketraceSearchQueryStored,
    };
  }

  const parts: string[] = [];
  if (cardName) parts.push(cardName);
  if (cardNumber) parts.push(cardNumber.replace(/^#/, ''));
  const setHint =
    (typeof psa?.setHint === 'string' && psa.setHint.trim()) ||
    (typeof card?.set === 'string' && card.set.trim()) ||
    '';
  if (setHint) parts.push(setHint);
  const year =
    (typeof psa?.year === 'string' && psa.year.trim()) ||
    (typeof card?.year === 'number' ? String(card.year) : '') ||
    '';
  if (year) parts.push(year);

  let query = normalizePoketraceSearchQueryString(
    parts.join(' ').replace(/\s+/g, ' ').trim(),
  );
  if (!query && poketraceSearchQueryStored) {
    query = normalizePoketraceSearchQueryString(poketraceSearchQueryStored);
  }
  const finalQuery = query || (poketraceCardId ? poketraceSearchQueryStored || 'pokemon' : 'pokemon');
  return {
    query: finalQuery,
    cardName,
    cardNumber,
    poketraceCardId,
    poketraceSearchQuery: poketraceSearchQueryStored,
  };
}

export function mintPreviewDedupeKey(
  query: string,
  cardName: string,
  cardNumber: string,
): string {
  const raw = `${query}|${cardName}|${cardNumber}`;
  return `mintpv_${createHash('sha256').update(raw).digest('hex').slice(0, 32)}`;
}
