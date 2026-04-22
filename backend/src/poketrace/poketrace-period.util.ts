/** Same union as marketplace bundle / batch snapshots (calendar windows). */
export type TokenablePriceHistoryDuration =
  | '7d'
  | '30d'
  | '90d'
  | '180d'
  | '365d';

/** PokeTrace `period` query on GET …/prices/{tier}/history (OpenAPI 1.5). */
export type PoketraceHistoryPeriod = '7d' | '30d' | '90d' | '1y' | 'all';

export function isPoketraceHistoryPeriod(s: string): s is PoketraceHistoryPeriod {
  return s === '7d' || s === '30d' || s === '90d' || s === '1y' || s === 'all';
}

/** Map bundle/list “calendar day” windows to the smallest upstream `period` that covers them. */
export function calendarDaysToFetchPeriod(days: number): PoketraceHistoryPeriod {
  const d = Math.min(4000, Math.max(1, Math.floor(days)));
  if (d <= 7) return '7d';
  if (d <= 30) return '30d';
  if (d <= 90) return '90d';
  if (d <= 366) return '1y';
  return 'all';
}

/** Tokenable marketplace duration → upstream `period` for history fetch. */
export function tokenablePriceHistoryDurationToPeriod(
  w: TokenablePriceHistoryDuration,
): PoketraceHistoryPeriod {
  switch (w) {
    case '7d':
      return '7d';
    case '30d':
      return '30d';
    case '90d':
      return '90d';
    case '180d':
    case '365d':
      return '1y';
    default:
      return '90d';
  }
}

/** Calendar days used after fetch for UTC-day dedupe + trim (may be stricter than `period`). */
export function maxCalendarDaysForTokenableWindow(w: TokenablePriceHistoryDuration): number {
  switch (w) {
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
    case '180d':
      return 180;
    case '365d':
      return 365;
    default:
      return 90;
  }
}

/** Post-fetch trim span aligned with the `period` we asked upstream for. */
export function poketracePeriodToMaxCalendarDays(p: PoketraceHistoryPeriod): number {
  switch (p) {
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
    case '1y':
      return 366;
    case 'all':
      return 365 * 5;
    default:
      return 90;
  }
}
