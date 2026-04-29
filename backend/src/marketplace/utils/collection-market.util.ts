/**
 * Parse legacy card-price search bodies for collection charts / list snapshots.
 */

export interface UsdPoint {
  t: number;
  v: number;
}

export interface GradePriceStrip {
  psa10: number | null;
  psa9: number | null;
  raw: number | null;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function numOrNull(x: unknown): number | null {
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  if (typeof x === 'string' && x.trim() !== '') {
    const n = parseFloat(x);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** e.g. `pokemon` → `Pokemon`, `magic-the-gathering` → `Magic The Gathering` */
export function formatGameIdLabel(gameId: string): string {
  return gameId
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function percentChangeFromPoints(points: UsdPoint[]): number | null {
  if (points.length < 2) return null;
  const a = points[0].v;
  const b = points[points.length - 1].v;
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return ((b - a) / a) * 100;
}

function historyFromVariant(v: Record<string, unknown>): UsdPoint[] {
  const ph = v.priceHistory;
  if (!Array.isArray(ph) || ph.length === 0) return [];
  const out: UsdPoint[] = [];
  for (const row of ph) {
    if (!isRecord(row)) continue;
    const t = numOrNull(row.t);
    const p = numOrNull(row.p);
    if (t == null || p == null) continue;
    out.push({ t, v: p });
  }
  out.sort((x, y) => x.t - y.t);
  return out;
}

/**
 * Best-effort PSA 10 / 9 / Raw strip from variant prices.
 * Variants are often condition/printing — we map high→mid→low by price when labels are absent.
 */
export function gradeStripFromVariants(variants: unknown[]): GradePriceStrip {
  const priced: { price: number; label: string }[] = [];
  for (const raw of variants) {
    if (!isRecord(raw)) continue;
    const price = numOrNull(raw.price);
    if (price == null) continue;
    const cond = String(raw.condition ?? '').toLowerCase();
    const printing = String(raw.printing ?? '').toLowerCase();
    const label = `${printing} ${cond}`.trim();
    priced.push({ price, label });
  }
  if (priced.length === 0) {
    return { psa10: null, psa9: null, raw: null };
  }

  const byPsaHint = () => {
    let p10: number | null = null;
    let p9: number | null = null;
    let raw: number | null = null;
    for (const row of priced) {
      const t = row.label;
      if (/\bpsa\s*10\b/i.test(t) || t.includes('gem mint')) p10 = row.price;
      else if (/\bpsa\s*9\b/i.test(t)) p9 = row.price;
      else if (/\braw\b/i.test(t) || t.includes('ungraded')) raw = row.price;
    }
    if (p10 != null || p9 != null || raw != null) {
      return { psa10: p10, psa9: p9, raw };
    }
    return null;
  };

  const hinted = byPsaHint();
  if (hinted) {
    const sorted = [...priced].sort((a, b) => b.price - a.price);
    return {
      psa10: hinted.psa10 ?? sorted[0]?.price ?? null,
      psa9: hinted.psa9 ?? sorted[1]?.price ?? null,
      raw: hinted.raw ?? sorted[sorted.length - 1]?.price ?? null,
    };
  }

  const sorted = [...priced].sort((a, b) => b.price - a.price);
  if (sorted.length >= 3) {
    return {
      psa10: sorted[0].price,
      psa9: sorted[1].price,
      raw: sorted[sorted.length - 1].price,
    };
  }
  if (sorted.length === 2) {
    return {
      psa10: sorted[0].price,
      psa9: sorted[1].price,
      raw: null,
    };
  }
  return {
    psa10: sorted[0].price,
    psa9: null,
    raw: null,
  };
}

export type ParsedMarketRow = {
  history: UsdPoint[];
  grades: GradePriceStrip;
  gameLabel: string | null;
};

const EMPTY_PARSED: ParsedMarketRow = {
  history: [],
  grades: { psa10: null, psa9: null, raw: null },
  gameLabel: null,
};

export function parseMarketSingleCardRow(row: Record<string, unknown>): ParsedMarketRow {
  const gameName = typeof row.game_name === 'string' ? row.game_name.trim() : '';
  const gameId = typeof row.game === 'string' ? row.game.trim() : '';
  const gameLabel = gameName || (gameId ? formatGameIdLabel(gameId) : null);

  const variants = Array.isArray(row.variants) ? row.variants : [];
  const grades = gradeStripFromVariants(variants);

  let history: UsdPoint[] = [];
  for (const v of variants) {
    if (!isRecord(v)) continue;
    const h = historyFromVariant(v);
    if (h.length >= history.length) history = h;
  }

  return { history, grades, gameLabel };
}

export function scoreMarketPriceParsed(p: ParsedMarketRow): number {
  let s = p.history.length * 10;
  if (p.grades.psa10 != null) s += 5;
  if (p.grades.psa9 != null) s += 3;
  if (p.grades.raw != null) s += 2;
  return s;
}

export function hasUsefulMarketData(p: ParsedMarketRow): boolean {
  return (
    p.history.length >= 2 ||
    p.grades.psa10 != null ||
    p.grades.psa9 != null ||
    p.grades.raw != null
  );
}

/** When search returns multiple cards, pick the row with the richest price history / variant prices. */
export function parseCardsResponseBest(body: unknown): ParsedMarketRow {
  if (!isRecord(body)) {
    return { ...EMPTY_PARSED };
  }
  const data = body.data;
  if (!Array.isArray(data) || data.length === 0) {
    return { ...EMPTY_PARSED };
  }
  let best: ParsedMarketRow = { ...EMPTY_PARSED };
  let bestScore = -1;
  for (const raw of data) {
    if (!isRecord(raw)) continue;
    const parsed = parseMarketSingleCardRow(raw);
    const sc = scoreMarketPriceParsed(parsed);
    if (sc > bestScore) {
      bestScore = sc;
      best = parsed;
    }
  }
  return best;
}

export function parseCardsResponse(body: unknown): ParsedMarketRow {
  if (!isRecord(body)) {
    return { ...EMPTY_PARSED };
  }
  const data = body.data;
  if (!Array.isArray(data) || data.length === 0) {
    return { ...EMPTY_PARSED };
  }
  const row = data[0];
  if (!isRecord(row)) {
    return { ...EMPTY_PARSED };
  }
  return parseMarketSingleCardRow(row);
}

/**
 * Ordered `game` query params to try for `q=` search fallback (PSA mint path defaults to pokemon).
 */
export function candidateGamesForCollection(row: {
  queryUsed: string | null;
  displayLabel: string;
  components: Record<string, unknown>;
}): string[] {
  const q = (row.queryUsed ?? '').toLowerCase();
  const label = row.displayLabel.toLowerCase();
  const cardName = String(row.components.cardName ?? '').toLowerCase();
  const cardSet = String(row.components.cardSet ?? '').toLowerCase();
  const hay = `${q} ${label} ${cardName} ${cardSet}`;
  const out: string[] = [];
  const add = (g: string) => {
    if (!out.includes(g)) out.push(g);
  };

  if (/\bpokemon\b|pikachu|charizard|blastoise|venusaur|vmax|vstar|\bex\b|lugia|mewtwo/.test(hay)) {
    add('pokemon');
  }
  if (/\bmtg\b|magic the gathering|mana|planeswalker|sorcery instant/.test(hay)) {
    add('magic-the-gathering');
  }
  if (/\byu-gi-oh|yugioh|konami/.test(hay)) {
    add('yugioh');
  }
  if (/\blorcana\b|disney/.test(hay)) {
    add('disney-lorcana');
  }
  if (/\bone piece\b/.test(hay)) {
    add('one-piece-card-game');
  }
  if (/\bnba\b|basketball|panini nba|\bhoops\b/.test(hay)) {
    add('panini-nba');
  }
  if (/\bnfl\b|panini nfl|super bowl/.test(hay)) {
    add('panini-nfl');
  }
  if (/\bmlb\b|topps baseball|bowman chrome.*baseball/.test(hay)) {
    add('topps-baseball');
  }

  if (out.length === 0) {
    add('pokemon');
  }
  return out;
}
