import { backendFetch, getApiUrl } from "./client";

export type DailyCount = { date: string; count: number };
export type DailyAmount = { date: string; amountUsdc: number };

export type TopCollectionRow = {
  collectionKey: string;
  displayLabel: string | null;
  count: number;
  gmvUsdc?: number;
};

export type RecentTradeRow = {
  orderHash: string;
  tokenId: string;
  collectionKey: string | null;
  displayLabel: string | null;
  priceUsdc: number;
  fulfilledAt: string;
};

export type OrderBreakdownRow = {
  side: string;
  status: string;
  count: number;
};

export type PlatformAnalyticsOverview = {
  users: {
    total: number;
    verified: number;
    unverified: number;
    privy: number;
    legacy: number;
    google: number;
    emailOtp: number;
    walletLogin: number;
    withWallet: number;
    newInPeriod: number;
    linkedWallets: number;
  };
  mints: {
    total: number;
    inPeriod: number;
    withListingEver: number;
    withFulfilledSale: number;
  };
  collections: {
    total: number;
    inPeriod: number;
    withActiveListing: number;
    withCardhedger: number;
    withFulfilledTrade: number;
  };
  orders: {
    activeAsks: number;
    activeBids: number;
    totalAsksEver: number;
    totalBidsEver: number;
    fulfilledSales: number;
    cancelled: number;
    expired: number;
    newAsksInPeriod: number;
    newBidsInPeriod: number;
    salesInPeriod: number;
  };
  trades: {
    gmvUsdcTotal: number;
    gmvUsdcInPeriod: number;
    avgSaleUsdc: number | null;
    uniqueSellers: number;
  };
  watchlist: {
    totalItems: number;
    uniqueUsers: number;
    uniqueCollections: number;
    addedInPeriod: number;
  };
  portfolio: {
    trackedWallets: number;
    snapshotRows: number;
    latestSnapshotDate: string | null;
    holdingsRows: number;
    holdingsWithCostBasis: number;
    holdingsHidden: number;
    costBasisBySource: {
      manual: number;
      vault_delivery: number;
      marketplace_buy: number;
    };
  };
  funnel: {
    signupToWalletPct: number | null;
    mintToListPct: number | null;
    listToSalePct: number | null;
  };
};

export type PlatformAnalyticsDashboard = {
  generatedAt: string;
  periodDays: number;
  chainId: number;
  overview: PlatformAnalyticsOverview;
  timeseries: {
    signups: DailyCount[];
    mints: DailyCount[];
    newAsks: DailyCount[];
    sales: DailyCount[];
    gmvUsdc: DailyAmount[];
  };
  topCollections: {
    byActiveListings: TopCollectionRow[];
    bySales: TopCollectionRow[];
    byWatchlist: TopCollectionRow[];
    byGmv: TopCollectionRow[];
  };
  recentTrades: RecentTradeRow[];
  ordersBreakdown: OrderBreakdownRow[];
};

export type AdminAnalyticsPeriod = 7 | 30 | 90;

async function parseAdminError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({}));
  throw new Error((err as { message?: string }).message ?? fallback);
}

export async function getAdminAnalyticsDashboard(
  days: AdminAnalyticsPeriod = 30,
): Promise<PlatformAnalyticsDashboard> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/analytics?days=${days}`,
  );
  if (!res.ok) await parseAdminError(res, "Failed to load analytics");
  return res.json() as Promise<PlatformAnalyticsDashboard>;
}
