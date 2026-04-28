function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

export function normalizePsaCardNameForMatching(name: string): string {
  return name
    .trim()
    .replace(/^(FA\/|GG\/|TG\/|CSR\/|SR\/)/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function primaryCardNumber(num: string): string {
  const t = num.replace(/^#/, '').trim();
  if (!t) return '';
  return t.split('/')[0].trim();
}

export function normalizeSearchQuery(q: string): string {
  return q
    .replace(/\b(FA|GG|TG|CSR|SR)\//gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildCardQueryFromRwaMetadata(metadata: unknown): {
  query: string;
  cardName: string;
  cardNumber: string;
  cardSet: string;
  cardId: string | null;
  searchQuery: string | null;
} {
  if (!isRecord(metadata)) {
    return {
      query: '',
      cardName: '',
      cardNumber: '',
      cardSet: '',
      cardId: null,
      searchQuery: null,
    };
  }
  const props = metadata.properties;
  const graded = isRecord(props) && isRecord(props.graded) ? props.graded : null;
  const ch = graded && isRecord(graded.cardhedger) ? graded.cardhedger : null;
  const cardId =
    typeof ch?.cardId === 'string' && ch.cardId.trim() ? ch.cardId.trim() : null;
  const searchQuery =
    typeof ch?.searchQuery === 'string' && ch.searchQuery.trim() ? ch.searchQuery.trim() : null;

  const psa = graded && isRecord(graded.psa) ? graded.psa : null;
  const card = graded && isRecord(graded.card) ? graded.card : null;

  // Two-layer identity (preferred): base_card is for Cardhedger matching (no autograph terms).
  const identity = graded && isRecord(graded.identity) ? graded.identity : null;
  const baseCard =
    identity && isRecord(identity.base_card)
      ? (identity.base_card as Record<string, unknown>)
      : null;

  const cardNameRaw =
    (typeof baseCard?.card_name === 'string' && baseCard.card_name.trim()) ||
    (typeof psa?.cardNameHint === 'string' && psa.cardNameHint.trim()) ||
    (typeof card?.name === 'string' && card.name.trim()) ||
    (typeof metadata.name === 'string' && metadata.name.trim()) ||
    '';
  const cardNumberRaw =
    (typeof baseCard?.card_number === 'string' && baseCard.card_number.trim()) ||
    (typeof psa?.cardNumberHint === 'string' && psa.cardNumberHint.trim()) ||
    (card?.number != null ? String(card.number).trim() : '') ||
    '';
  const cardSet =
    (typeof baseCard?.set === 'string' && baseCard.set.trim()) ||
    (typeof psa?.setHint === 'string' && psa.setHint.trim()) ||
    (typeof card?.set === 'string' && card.set.trim()) ||
    '';

  const cardName = normalizePsaCardNameForMatching(cardNameRaw) || cardNameRaw;
  const cardNumber = primaryCardNumber(cardNumberRaw) || cardNumberRaw.replace(/^#/, '');

  if (searchQuery) {
    return {
      query: normalizeSearchQuery(searchQuery) || searchQuery,
      cardName,
      cardNumber,
      cardSet,
      cardId,
      searchQuery,
    };
  }
  const query = normalizeSearchQuery([cardName, cardNumber, cardSet].filter(Boolean).join(' '));
  return {
    query: query || 'pokemon',
    cardName,
    cardNumber,
    cardSet,
    cardId,
    searchQuery,
  };
}

export function normalizeForExactCatalogMatch(s: string): string {
  return normalizePsaCardNameForMatching(s)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function normalizeForExactCardNumberKey(s: string): string {
  return s
    .replace(/^#/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function exactCatalogMatch(
  hints: { cardName: string; cardNumber: string; cardSet: string },
  row: Record<string, unknown>,
): { ok: boolean; failCodes: string[] } {
  const set = isRecord(row.set) ? row.set : null;
  const setNameGot = typeof set?.name === 'string' ? set.name : String(row.set ?? '');
  const nameGot = typeof row.name === 'string' ? row.name : String(row.description ?? '');
  const numGot =
    typeof row.cardNumber === 'string' ? row.cardNumber : String(row.number ?? '');
  const nameWant = normalizeForExactCatalogMatch(hints.cardName);
  const setWant = normalizeForExactCatalogMatch(hints.cardSet);
  const setGot = normalizeForExactCatalogMatch(setNameGot);
  const numWant = normalizeForExactCardNumberKey(primaryCardNumber(hints.cardNumber));
  const numGotN = normalizeForExactCardNumberKey(primaryCardNumber(numGot));
  const nameGotN = normalizeForExactCatalogMatch(nameGot);
  const failCodes: string[] = [];
  if (nameWant !== nameGotN) failCodes.push('name_mismatch');
  if (setWant !== setGot) failCodes.push('set_mismatch');
  if (numWant !== numGotN) failCodes.push('number_mismatch');
  return { ok: failCodes.length === 0, failCodes };
}

