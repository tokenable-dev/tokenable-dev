export type TapeFillSource = 'platform' | 'cardhedger';

/** Order book / trades tape row (platform fills + Cardhedger comps). */
export type PlatformTapeFillRow = {
  t: number;
  priceUsdc: number;
  tokenId: string;
  orderHash: string;
  tapeAggressor?: 'buy' | 'sell';
  source: TapeFillSource;
  /** Cardhedger comps `sale_type` when {@link source} is `cardhedger`. */
  externalSaleType?: string | null;
};

export type TradesVolumeWindowStats = {
  notionalUsdc: number;
  tradeCount: number;
  platformCount: number;
  cardhedgerCount: number;
};

export type TradesVolumeWindowKey = '7d' | '30d' | '90d' | '180d' | '365d';

export type CollectionTradesVolumeStats = {
  /** Calendar-day windows over the full merged tape returned by the API. */
  windows: Record<TradesVolumeWindowKey, TradesVolumeWindowStats>;
  /** Lifetime totals for all rows in the returned tape. */
  total: TradesVolumeWindowStats;
};

const SEC_DAY = 86_400;

export const TRADES_VOLUME_WINDOW_DAYS: Record<TradesVolumeWindowKey, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '180d': 180,
  '365d': 365,
};

/** Cardhedger daily close used to backfill tape when comps raw (max 100) is shorter than Vol window. */
export const CARDHEDGER_REFERENCE_DAILY_SALE_TYPE = 'Daily reference';

/** Default trades tape backfill — aligns with common Vol / Chg window. */
export const CARDHEDGER_TAPE_REFERENCE_COVERAGE_DAYS = 180;

function utcDayKey(tSec: number): string {
  const d = new Date(tSec * 1000);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

export function isVolumeCountableTapeRow(row: PlatformTapeFillRow): boolean {
  if (!Number.isFinite(row.priceUsdc) || row.priceUsdc <= 0) return false;
  if (row.source !== 'cardhedger') return true;
  return row.externalSaleType !== CARDHEDGER_REFERENCE_DAILY_SALE_TYPE;
}

/**
 * Fill calendar days without individual comps using Cardhedger daily reference closes.
 * Volume excludes these rows; trades tape shows them as REF.
 */
export function supplementCardhedgerTapeWithDailyReference(
  compsRows: PlatformTapeFillRow[],
  dailyPoints: Array<{ t: number; v: number }>,
  cardId: string,
  minCoverageSec: number,
  nowSec = Math.floor(Date.now() / 1000),
): PlatformTapeFillRow[] {
  if (minCoverageSec <= 0 || dailyPoints.length === 0) return compsRows;

  const cutoff = nowSec - minCoverageSec;
  const id = cardId?.trim() || 'na';
  const compDays = new Set<string>();
  for (const row of compsRows) {
    if (row.t >= cutoff) compDays.add(utcDayKey(row.t));
  }

  const supplemental: PlatformTapeFillRow[] = [];
  for (const p of dailyPoints) {
    if (p.t < cutoff || !Number.isFinite(p.v) || p.v <= 0) continue;
    const dk = utcDayKey(p.t);
    if (compDays.has(dk)) continue;
    compDays.add(dk);
    supplemental.push({
      t: p.t,
      priceUsdc: p.v,
      tokenId: '—',
      orderHash: `cardhedger:ref:${id}:${p.t}`,
      source: 'cardhedger',
      externalSaleType: CARDHEDGER_REFERENCE_DAILY_SALE_TYPE,
    });
  }

  return [...compsRows, ...supplemental];
}

export function cardhedgerRawSalesToTapeRows(
  rawSales: Array<{ t: number; v: number; saleType?: string | null }>,
  cardId: string | null,
): PlatformTapeFillRow[] {
  const id = cardId?.trim() || 'na';
  return rawSales
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v) && p.v > 0)
    .map((p, i) => ({
      t: p.t,
      priceUsdc: p.v,
      tokenId: '—',
      orderHash: `cardhedger:${id}:${p.t}:${i}`,
      source: 'cardhedger' as const,
      externalSaleType: p.saleType ?? null,
    }));
}

/** Newest first; platform row wins on exact t+price duplicate. */
export function mergePlatformAndCardhedgerTape(
  platform: PlatformTapeFillRow[],
  cardhedger: PlatformTapeFillRow[],
): PlatformTapeFillRow[] {
  const byKey = new Map<string, PlatformTapeFillRow>();
  for (const row of cardhedger) {
    const key = `${row.t}:${row.priceUsdc.toFixed(4)}`;
    if (!byKey.has(key)) byKey.set(key, row);
  }
  for (const row of platform) {
    const key = `${row.t}:${row.priceUsdc.toFixed(4)}`;
    byKey.set(key, row);
  }
  return [...byKey.values()].sort((a, b) => b.t - a.t);
}

function emptyWindowStats(): TradesVolumeWindowStats {
  return {
    notionalUsdc: 0,
    tradeCount: 0,
    platformCount: 0,
    cardhedgerCount: 0,
  };
}

function addRowToWindowStats(
  stats: TradesVolumeWindowStats,
  row: PlatformTapeFillRow,
): void {
  stats.notionalUsdc += row.priceUsdc;
  stats.tradeCount++;
  if (row.source === 'cardhedger') stats.cardhedgerCount++;
  else stats.platformCount++;
}

export function computeCollectionTradesVolumeStats(
  trades: PlatformTapeFillRow[],
  nowSec = Math.floor(Date.now() / 1000),
): CollectionTradesVolumeStats {
  const windows = Object.fromEntries(
    (Object.keys(TRADES_VOLUME_WINDOW_DAYS) as TradesVolumeWindowKey[]).map(
      (key) => [key, emptyWindowStats()],
    ),
  ) as Record<TradesVolumeWindowKey, TradesVolumeWindowStats>;
  const total = emptyWindowStats();

  const cutoffs = Object.fromEntries(
    (Object.entries(TRADES_VOLUME_WINDOW_DAYS) as [TradesVolumeWindowKey, number][]).map(
      ([key, days]) => [key, nowSec - days * SEC_DAY],
    ),
  ) as Record<TradesVolumeWindowKey, number>;

  for (const row of trades) {
    if (!isVolumeCountableTapeRow(row)) continue;
    addRowToWindowStats(total, row);

    for (const key of Object.keys(TRADES_VOLUME_WINDOW_DAYS) as TradesVolumeWindowKey[]) {
      if (row.t >= cutoffs[key]) {
        addRowToWindowStats(windows[key], row);
      }
    }
  }

  return { windows, total };
}
