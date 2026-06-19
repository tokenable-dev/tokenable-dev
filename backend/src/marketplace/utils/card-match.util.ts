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

/**
 * Cardhedger `card-search` token — strip leading zeros on pure numeric #s (PSA `024` → `#24`).
 * Alphanumeric promos (`SWSH029`) are unchanged. Bucket/audit keys still use {@link primaryCardNumber}.
 */
export function cardNumberTokenForCardhedgerSearch(num: string): string {
  const primary = primaryCardNumber(num);
  if (!primary) return '';
  if (/^\d+$/.test(primary)) {
    const stripped = primary.replace(/^0+/, '') || primary;
    return `#${stripped}`;
  }
  return `#${primary}`;
}

export function normalizeForExactCatalogMatch(s: string): string {
  return normalizePsaCardNameForMatching(s)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function normalizeForExactCardNumberKey(s: string): string {
  let t = s
    .replace(/^#/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
  if (/^\d+$/.test(t)) {
    t = t.replace(/^0+/, '') || '0';
  }
  return t;
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

/**
 * Audit stored `cardhedgerCardId` against catalog row — tolerates abbreviated mint
 * `cardName`/`cardSet` vs full Cardhedger titles (e.g. "cooper flagg" + "topps chrome"
 * vs "Cooper Flagg … Refractor" in "2025 Topps Chrome Basketball").
 */
export function relaxedCatalogMatchForAudit(
  hints: {
    cardName: string;
    cardNumber: string;
    cardSet: string;
    psaSubject?: string;
    psaBrand?: string;
  },
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

  const numWant = normalizeForExactCardNumberKey(
    primaryCardNumber(hints.cardNumber),
  );
  const numGotN = normalizeForExactCardNumberKey(primaryCardNumber(numGot));
  const failCodes: string[] = [];
  if (numWant !== numGotN) failCodes.push('number_mismatch');

  const nameGotN = normalizeForExactCatalogMatch(nameGot);
  const nameCandidates = [hints.psaSubject, hints.cardName]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean);
  const nameOk = nameCandidates.some((want) => {
    const w = normalizeForExactCatalogMatch(want);
    return Boolean(w && nameGotN && (nameGotN.includes(w) || w.includes(nameGotN)));
  });
  if (!nameOk) failCodes.push('name_mismatch');

  const setGot = normalizeForExactCatalogMatch(setNameGot);
  const setCandidates = [hints.psaBrand, hints.cardSet]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean);
  const setOk = setCandidates.some((want) => {
    const w = normalizeForExactCatalogMatch(want);
    return Boolean(w && setGot && (setGot.includes(w) || w.includes(setGot)));
  });
  if (!setOk) failCodes.push('set_mismatch');

  return { ok: failCodes.length === 0, failCodes };
}

export type CatalogTrustHints = {
  cardName: string;
  cardNumber: string;
  cardSet: string;
  psaSubject?: string;
  psaBrand?: string;
  psaYear?: string;
  cardhedgerSearchQuery?: string;
  listingDisplayTitle?: string;
};

/** First 4-digit year in [1990, 2100] from catalog copy (set name, PSA brand, listing title, …). */
export function extractLeadingCatalogYear(text: string | null | undefined): number | null {
  const m = String(text ?? '').match(/\b(19\d{2}|20\d{2})\b/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  return y >= 1990 && y <= 2100 ? y : null;
}

export function catalogYearFromTrustHints(hints: CatalogTrustHints): number | null {
  const fromField = extractLeadingCatalogYear(hints.psaYear);
  if (fromField != null) return fromField;
  for (const blob of [
    hints.psaBrand,
    hints.cardSet,
    hints.listingDisplayTitle,
    hints.cardhedgerSearchQuery,
  ]) {
    const y = extractLeadingCatalogYear(blob);
    if (y != null) return y;
  }
  return null;
}

export function catalogYearFromCardhedgerRow(row: Record<string, unknown>): number | null {
  const set = isRecord(row.set) ? row.set : null;
  const setName =
    typeof set?.name === 'string' ? set.name : String(row.set ?? '');
  const blob = [
    setName,
    typeof row.name === 'string' ? row.name : '',
    typeof row.description === 'string' ? row.description : '',
    typeof row.variant === 'string' ? row.variant : '',
  ].join(' ');
  return extractLeadingCatalogYear(blob);
}

/**
 * Stricter than {@link relaxedCatalogMatchForAudit} for comps / trades / stored card_id trust.
 * Rejects cross-era mismatches (e.g. 2000 Italian Base Set vs 2023 SV promo) when both years are known.
 */
export function catalogRowTrustedForMarketData(
  hints: CatalogTrustHints,
  row: Record<string, unknown>,
): { ok: boolean; failCodes: string[] } {
  const wantNum = primaryCardNumber(hints.cardNumber).trim();
  if (!wantNum) {
    return { ok: false, failCodes: ['missing_card_number'] };
  }

  const audit = relaxedCatalogMatchForAudit(
    {
      cardName: hints.cardName,
      cardNumber: hints.cardNumber,
      cardSet: hints.cardSet,
      psaSubject: hints.psaSubject,
      psaBrand: hints.psaBrand,
    },
    row,
  );
  if (!audit.ok) return audit;

  const hintYear = catalogYearFromTrustHints(hints);
  const rowYear = catalogYearFromCardhedgerRow(row);
  if (hintYear != null && rowYear != null && Math.abs(hintYear - rowYear) > 1) {
    return { ok: false, failCodes: [...audit.failCodes, 'year_mismatch'] };
  }

  return audit;
}

export function catalogTrustHintsFromComponents(
  comp: Record<string, unknown> | null | undefined,
): CatalogTrustHints {
  const c = comp ?? {};
  return {
    cardName: String(c.cardName ?? '').trim(),
    cardNumber: String(c.cardNumber ?? '').trim(),
    cardSet: String(c.cardSet ?? '').trim(),
    psaSubject:
      typeof c.psaSubject === 'string' && c.psaSubject.trim()
        ? c.psaSubject.trim()
        : undefined,
    psaBrand:
      typeof c.psaBrand === 'string' && c.psaBrand.trim()
        ? c.psaBrand.trim()
        : undefined,
    psaYear:
      typeof c.psaYear === 'string' && c.psaYear.trim()
        ? c.psaYear.trim()
        : typeof c.psaYear === 'number' && Number.isFinite(c.psaYear)
          ? String(Math.floor(c.psaYear))
          : undefined,
    cardhedgerSearchQuery:
      typeof c.cardhedgerSearchQuery === 'string' && c.cardhedgerSearchQuery.trim()
        ? c.cardhedgerSearchQuery.trim()
        : undefined,
    listingDisplayTitle:
      typeof c.listingDisplayTitle === 'string' && c.listingDisplayTitle.trim()
        ? c.listingDisplayTitle.trim()
        : undefined,
  };
}
