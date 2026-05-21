function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function normalizePsaCardNameForMatching(name: string): string {
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
  const setNameGot =
    typeof set?.name === 'string' ? set.name : String(row.set ?? '');
  const nameGot =
    typeof row.name === 'string' ? row.name : String(row.description ?? '');
  const numGot =
    typeof row.cardNumber === 'string'
      ? row.cardNumber
      : String(row.number ?? '');
  const nameWant = normalizeForExactCatalogMatch(hints.cardName);
  const setWant = normalizeForExactCatalogMatch(hints.cardSet);
  const setGot = normalizeForExactCatalogMatch(setNameGot);
  const numWant = normalizeForExactCardNumberKey(
    primaryCardNumber(hints.cardNumber),
  );
  const numGotN = normalizeForExactCardNumberKey(primaryCardNumber(numGot));
  const nameGotN = normalizeForExactCatalogMatch(nameGot);
  const failCodes: string[] = [];
  if (nameWant !== nameGotN) failCodes.push('name_mismatch');
  if (setWant !== setGot) failCodes.push('set_mismatch');
  if (numWant !== numGotN) failCodes.push('number_mismatch');
  return { ok: failCodes.length === 0, failCodes };
}
