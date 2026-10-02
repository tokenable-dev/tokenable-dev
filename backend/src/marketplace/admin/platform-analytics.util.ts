export const USDC_DECIMALS = 6;

export function microsToUsdc(micros: string | number | null | undefined): number {
  if (micros == null) return 0;
  const n = typeof micros === 'string' ? Number(micros) : micros;
  if (!Number.isFinite(n)) return 0;
  return n / 10 ** USDC_DECIMALS;
}

export function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export type DailyCount = { date: string; count: number };
export type DailyAmount = { date: string; amountUsdc: number };

/** UTC calendar day bucket for timestamptz columns (TypeORM property refs). */
export function sqlDayBucket(columnRef: string): string {
  return `DATE_TRUNC('day', ${columnRef} AT TIME ZONE 'UTC')::date`;
}

export function fillDailyCounts(
  rows: { day: string; count: string | number }[],
  days: number,
): DailyCount[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = String(row.day).slice(0, 10);
    map.set(key, Number(row.count) || 0);
  }
  const out: DailyCount[] = [];
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, count: map.get(key) ?? 0 });
  }
  return out;
}

export function fillDailyAmounts(
  rows: { day: string; amount: string | number }[],
  days: number,
): DailyAmount[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = String(row.day).slice(0, 10);
    map.set(key, microsToUsdc(row.amount));
  }
  const out: DailyAmount[] = [];
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, amountUsdc: map.get(key) ?? 0 });
  }
  return out;
}
