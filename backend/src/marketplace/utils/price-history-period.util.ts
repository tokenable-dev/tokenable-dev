export type TokenablePriceHistoryDuration =
  | '7d'
  | '30d'
  | '90d'
  | '180d'
  | '365d';

export type MarketHistoryPeriod = '7d' | '30d' | '90d' | '1y';

export function isMarketHistoryPeriod(s: string): s is MarketHistoryPeriod {
  return s === '7d' || s === '30d' || s === '90d' || s === '1y';
}

export function tokenablePriceHistoryDurationToPeriod(
  w: TokenablePriceHistoryDuration,
): MarketHistoryPeriod {
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

export function marketPeriodToMaxCalendarDays(p: MarketHistoryPeriod): number {
  switch (p) {
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
    case '1y':
      return 365;
    default:
      return 90;
  }
}
