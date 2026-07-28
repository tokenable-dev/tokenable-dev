import { cardhedgerSetAliasTokens } from './cardhedger-search-alias.util';

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

/** PSA insert codes like `RSLW4` / `SS-LW4` (letters + digits), not pure checklist `#18`. */
export function isAlphanumericInsertCardNumber(num: string): boolean {
  const t = primaryCardNumber(num);
  return Boolean(t) && /[a-z]/i.test(t) && /\d/.test(t);
}

export function isPureNumericCardNumber(num: string): boolean {
  const t = primaryCardNumber(num);
  return /^\d+$/.test(t);
}

/**
 * Product-family tokens that must not cross-match (Prizm ↔ Dominion, Chrome ↔ Select, …)
 * when present on the PSA / mint side.
 */
const CATALOG_PRODUCT_FAMILY_TOKENS = [
  'prizm',
  'chrome',
  'select',
  'optic',
  'mosaic',
  'dominion',
  'donruss',
  'bowman',
  'topps',
  'fleer',
  'upperdeck',
  'panini',
] as const;

function catalogProductFamiliesIn(text: string): string[] {
  const n = normalizeForExactCatalogMatch(text);
  if (!n) return [];
  return CATALOG_PRODUCT_FAMILY_TOKENS.filter((t) => n.includes(t));
}

/**
 * When PSA Brand/set names a product family (e.g. Prizm), Cardhedger row set/description
 * must share at least one of those families — blocks Dominion hits for Prizm inserts.
 */
export function catalogProductFamiliesCompatible(
  hints: {
    cardSet: string;
    psaBrand?: string;
    cardhedgerSearchQuery?: string;
  },
  row: Record<string, unknown>,
): boolean {
  const wantBlob = [hints.psaBrand, hints.cardSet, hints.cardhedgerSearchQuery]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)
    .join(' ');
  const wantFamilies = catalogProductFamiliesIn(wantBlob).filter(
    (t) => t !== 'panini' && t !== 'topps',
  );
  if (wantFamilies.length === 0) return true;

  const set = isRecord(row.set) ? row.set : null;
  const setName =
    typeof set?.name === 'string' ? set.name : String(row.set ?? '');
  const gotBlob = [
    setName,
    String(row.variant ?? ''),
    String(row.description ?? ''),
    String(row.name ?? ''),
  ].join(' ');
  const gotFamilies = new Set(catalogProductFamiliesIn(gotBlob));
  return wantFamilies.some((f) => gotFamilies.has(f));
}

/**
 * PSA slab insert # (RSLW4) vs Cardhedger checklist # (18) when the catalog line is
 * identified by player + insert Variety in the row description (variant often stays Base).
 */
export function catalogInsertNumberCompatibleWithRow(
  hints: {
    cardName: string;
    cardNumber: string;
    cardSet: string;
    psaSubject?: string;
    psaBrand?: string;
    psaVariety?: string;
    cardhedgerSearchQuery?: string;
  },
  row: Record<string, unknown>,
): boolean {
  const wantNum = normalizeForExactCardNumberKey(
    primaryCardNumber(hints.cardNumber),
  );
  const numGot =
    typeof row.cardNumber === 'string'
      ? row.cardNumber
      : String(row.number ?? '');
  const gotNum = normalizeForExactCardNumberKey(primaryCardNumber(numGot));
  if (!wantNum || !gotNum) return false;
  if (wantNum === gotNum) return true;
  if (!(isAlphanumericInsertCardNumber(wantNum) && isPureNumericCardNumber(gotNum))) {
    return false;
  }

  const nameGot =
    typeof row.name === 'string' ? row.name : String(row.description ?? '');
  const nameGotN = normalizeForExactCatalogMatch(nameGot);
  const nameOk = [hints.psaSubject, hints.cardName]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)
    .some((want) => {
      const w = normalizeForExactCatalogMatch(want);
      return Boolean(w && nameGotN && (nameGotN.includes(w) || w.includes(nameGotN)));
    });
  if (!nameOk) return false;

  if (
    !catalogProductFamiliesCompatible(
      {
        cardSet: hints.cardSet,
        psaBrand: hints.psaBrand,
        cardhedgerSearchQuery: hints.cardhedgerSearchQuery,
      },
      row,
    )
  ) {
    return false;
  }

  const variety = String(hints.psaVariety ?? '').trim();
  if (!variety) return false;
  const rowBlob = [
    String(row.variant ?? ''),
    String(row.description ?? ''),
    String(row.name ?? ''),
    typeof (isRecord(row.set) ? row.set.name : row.set) === 'string'
      ? String(isRecord(row.set) ? row.set.name : row.set)
      : '',
  ]
    .join(' ')
    .toLowerCase();
  const varietyChunks = variety
    .toLowerCase()
    .split(/[\s.\-/]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);
  if (varietyChunks.length === 0) return false;
  return varietyChunks.every((c) => rowBlob.includes(c));
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
    psaVariety?: string;
    cardhedgerSearchQuery?: string;
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
  const numberExact = Boolean(numWant && numGotN && numWant === numGotN);
  const numberInsertBridge = catalogInsertNumberCompatibleWithRow(
    {
      cardName: hints.cardName,
      cardNumber: hints.cardNumber,
      cardSet: hints.cardSet,
      psaSubject: hints.psaSubject,
      psaBrand: hints.psaBrand,
      psaVariety: hints.psaVariety,
      cardhedgerSearchQuery: hints.cardhedgerSearchQuery,
    },
    row,
  );
  if (!numberExact && !numberInsertBridge) failCodes.push('number_mismatch');

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
  const rowSetBlob = normalizeForExactCatalogMatch(
    [setNameGot, nameGot, String(row.variant ?? ''), String(row.description ?? '')]
      .filter(Boolean)
      .join(' '),
  );
  const setCandidates = [
    hints.psaBrand,
    hints.cardSet,
    hints.cardhedgerSearchQuery,
    ...cardhedgerSetAliasTokens(hints.cardSet, hints.psaBrand ?? null),
  ]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean);
  const setOk = setCandidates.some((want) => {
    const w = normalizeForExactCatalogMatch(want);
    return Boolean(
      w &&
        ((setGot && (setGot.includes(w) || w.includes(setGot))) ||
          (rowSetBlob && (rowSetBlob.includes(w) || w.includes(rowSetBlob)))),
    );
  });
  if (!setOk) failCodes.push('set_mismatch');

  if (
    !catalogProductFamiliesCompatible(
      {
        cardSet: hints.cardSet,
        psaBrand: hints.psaBrand,
        cardhedgerSearchQuery: hints.cardhedgerSearchQuery,
      },
      row,
    )
  ) {
    failCodes.push('product_family_mismatch');
  }

  return { ok: failCodes.length === 0, failCodes };
}

export type CatalogTrustHints = {
  cardName: string;
  cardNumber: string;
  cardSet: string;
  psaSubject?: string;
  psaBrand?: string;
  psaVariety?: string;
  psaYear?: string;
  cardhedgerSearchQuery?: string;
  listingDisplayTitle?: string;
};

/** `components.cardhedgerCardIdSource` when ID came from PSA `details-by-certs`. */
export const CARDHEDGER_CARD_ID_SOURCE_PSA_CERT = 'psa_cert';

export function cardIdFromPsaCertLookup(
  comp: Record<string, unknown> | null | undefined,
): boolean {
  return (
    String(comp?.cardhedgerCardIdSource ?? '').trim() ===
    CARDHEDGER_CARD_ID_SOURCE_PSA_CERT
  );
}

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
      psaVariety: hints.psaVariety,
      cardhedgerSearchQuery: hints.cardhedgerSearchQuery,
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
    psaVariety:
      typeof c.psaVariety === 'string' && c.psaVariety.trim()
        ? c.psaVariety.trim()
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
