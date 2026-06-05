export type CardladderIndexDirection = 'up' | 'down';

export type CardladderScrapedIndex = {
  slug: string;
  name: string;
  changePct: number;
  direction: CardladderIndexDirection;
  href: string;
};

export type CardladderDashboardIndexId = 'pokemon' | 'mlb' | 'nfl' | 'nba';

export type CardladderDashboardIndexRow = {
  id: CardladderDashboardIndexId;
  slug: string;
  name: string;
  changePct: number | null;
  direction: CardladderIndexDirection | null;
};

export type CardladderIndexesResponse = {
  data: CardladderDashboardIndexRow[];
  updatedAt: string;
  source: 'cardladder';
  stale: boolean;
};

export const CARDLADDER_DASHBOARD_SLOTS: ReadonlyArray<{
  id: CardladderDashboardIndexId;
  title: string;
  slug: string;
}> = [
  { id: 'pokemon', title: 'Pokemon Index', slug: 'pokemon' },
  { id: 'mlb', title: 'MLB Index', slug: 'baseball' },
  { id: 'nfl', title: 'NFL Index', slug: 'football' },
  { id: 'nba', title: 'NBA Index', slug: 'basketball' },
];
