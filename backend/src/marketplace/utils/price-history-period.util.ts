export type MarketHistoryPeriod = '7d' | '30d' | '90d' | '1y';

export function isMarketHistoryPeriod(s: string): s is MarketHistoryPeriod {
  return s === '7d' || s === '30d' || s === '90d' || s === '1y';
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
