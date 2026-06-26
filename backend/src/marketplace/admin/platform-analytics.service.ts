import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { UserWallet } from '../../user/entities/user-wallet.entity';
import { CollectionMarketSnapshot } from '../entities/collection-market-snapshot.entity';
import { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import {
  Order,
  OrderSide,
  OrderStatus,
} from '../entities/order.entity';
import { PortfolioDailySnapshot } from '../entities/portfolio-daily-snapshot.entity';
import { RwaToken } from '../entities/rwa-token.entity';
import { UserWatchlist } from '../entities/user-watchlist.entity';
import { UserAdminService, type AdminUserStats } from './user-admin.service';
import {
  fillDailyAmounts,
  fillDailyCounts,
  microsToUsdc,
  pct,
  sqlDayBucket,
  type DailyAmount,
  type DailyCount,
} from './platform-analytics.util';

export type { DailyAmount, DailyCount };

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
  users: AdminUserStats & {
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

@Injectable()
export class PlatformAnalyticsService {
  private readonly logger = new Logger(PlatformAnalyticsService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(UserWallet)
    private readonly walletsRepo: Repository<UserWallet>,
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
    @InjectRepository(RwaToken)
    private readonly rwaRepo: Repository<RwaToken>,
    @InjectRepository(MarketplaceCollection)
    private readonly collectionsRepo: Repository<MarketplaceCollection>,
    @InjectRepository(CollectionMarketSnapshot)
    private readonly snapshotsRepo: Repository<CollectionMarketSnapshot>,
    @InjectRepository(UserWatchlist)
    private readonly watchlistRepo: Repository<UserWatchlist>,
    @InjectRepository(PortfolioDailySnapshot)
    private readonly portfolioRepo: Repository<PortfolioDailySnapshot>,
    private readonly userAdmin: UserAdminService,
  ) {}

  async getDashboard(days = 30): Promise<PlatformAnalyticsDashboard> {
    try {
      return await this.buildDashboard(days);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Platform analytics failed: ${message}`, err instanceof Error ? err.stack : undefined);
      throw err;
    }
  }

  private async buildDashboard(days = 30): Promise<PlatformAnalyticsDashboard> {
    const periodDays = days;
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - periodDays);
    since.setUTCHours(0, 0, 0, 0);

    const [
      userStats,
      overviewCounts,
      timeseries,
      topCollections,
      recentTrades,
      ordersBreakdown,
    ] = await Promise.all([
      this.userAdmin.getStats(),
      this.loadOverviewCounts(since),
      this.loadTimeseries(periodDays, since),
      this.loadTopCollections(),
      this.loadRecentTrades(),
      this.loadOrdersBreakdown(),
    ]);

    const overview: PlatformAnalyticsOverview = {
      users: {
        ...userStats,
        newInPeriod: overviewCounts.newUsers,
        linkedWallets: overviewCounts.linkedWallets,
      },
      mints: {
        total: overviewCounts.mintsTotal,
        inPeriod: overviewCounts.mintsInPeriod,
        withListingEver: overviewCounts.mintedWithListing,
        withFulfilledSale: overviewCounts.mintedWithSale,
      },
      collections: {
        total: overviewCounts.collectionsTotal,
        inPeriod: overviewCounts.collectionsInPeriod,
        withActiveListing: overviewCounts.collectionsWithActiveListing,
        withCardhedger: overviewCounts.collectionsWithCardhedger,
        withFulfilledTrade: overviewCounts.collectionsWithSale,
      },
      orders: {
        activeAsks: overviewCounts.activeAsks,
        activeBids: overviewCounts.activeBids,
        totalAsksEver: overviewCounts.totalAsks,
        totalBidsEver: overviewCounts.totalBids,
        fulfilledSales: overviewCounts.fulfilledSales,
        cancelled: overviewCounts.cancelledOrders,
        expired: overviewCounts.expiredOrders,
        newAsksInPeriod: overviewCounts.newAsksInPeriod,
        newBidsInPeriod: overviewCounts.newBidsInPeriod,
        salesInPeriod: overviewCounts.salesInPeriod,
      },
      trades: {
        gmvUsdcTotal: microsToUsdc(overviewCounts.gmvMicrosTotal),
        gmvUsdcInPeriod: microsToUsdc(overviewCounts.gmvMicrosInPeriod),
        avgSaleUsdc:
          overviewCounts.fulfilledSales > 0
            ? microsToUsdc(overviewCounts.gmvMicrosTotal) /
              overviewCounts.fulfilledSales
            : null,
        uniqueSellers: overviewCounts.uniqueSellers,
      },
      watchlist: {
        totalItems: overviewCounts.watchlistItems,
        uniqueUsers: overviewCounts.watchlistUsers,
        uniqueCollections: overviewCounts.watchlistCollections,
        addedInPeriod: overviewCounts.watchlistAddedInPeriod,
      },
      portfolio: {
        trackedWallets: overviewCounts.portfolioWallets,
        snapshotRows: overviewCounts.portfolioRows,
        latestSnapshotDate: overviewCounts.portfolioLatestDate,
      },
      funnel: {
        signupToWalletPct: pct(userStats.withWallet, userStats.total),
        mintToListPct: pct(
          overviewCounts.mintedWithListing,
          overviewCounts.mintsTotal,
        ),
        listToSalePct: pct(
          overviewCounts.mintedWithSale,
          overviewCounts.mintedWithListing,
        ),
      },
    };

    return {
      generatedAt: new Date().toISOString(),
      periodDays,
      overview,
      timeseries,
      topCollections,
      recentTrades,
      ordersBreakdown,
    };
  }

  private async loadOverviewCounts(since: Date) {
    const [
      newUsers,
      linkedWallets,
      mintsTotal,
      mintsInPeriod,
      mintedWithListing,
      mintedWithSale,
      collectionsTotal,
      collectionsInPeriod,
      collectionsWithActiveListing,
      collectionsWithCardhedger,
      collectionsWithSale,
      activeAsks,
      activeBids,
      totalAsks,
      totalBids,
      fulfilledSales,
      cancelledOrders,
      expiredOrders,
      newAsksInPeriod,
      newBidsInPeriod,
      salesInPeriod,
      gmvRow,
      gmvPeriodRow,
      uniqueSellersRow,
      watchlistItems,
      watchlistUsers,
      watchlistCollections,
      watchlistAddedInPeriod,
      portfolioWallets,
      portfolioRows,
      portfolioLatest,
    ] = await Promise.all([
      this.usersRepo
        .createQueryBuilder('u')
        .where('u.createdAt >= :since', { since })
        .getCount(),
      this.safeCount(() => this.walletsRepo.count()),
      this.rwaRepo.count(),
      this.rwaRepo
        .createQueryBuilder('t')
        .where('t.createdAt >= :since', { since })
        .getCount(),
      this.ordersRepo
        .createQueryBuilder('o')
        .select('COUNT(DISTINCT o.tokenId)::int', 'count')
        .where('o.side = :side', { side: OrderSide.ASK })
        .getRawOne<{ count: number }>(),
      this.ordersRepo
        .createQueryBuilder('o')
        .select('COUNT(DISTINCT o.tokenId)::int', 'count')
        .where('o.side = :side', { side: OrderSide.ASK })
        .andWhere('o.status = :st', { st: OrderStatus.FULFILLED })
        .getRawOne<{ count: number }>(),
      this.collectionsRepo.count(),
      this.collectionsRepo
        .createQueryBuilder('c')
        .where('c.createdAt >= :since', { since })
        .getCount(),
      this.ordersRepo
        .createQueryBuilder('o')
        .select('COUNT(DISTINCT o.collectionKey)::int', 'count')
        .where('o.status = :st', { st: OrderStatus.ACTIVE })
        .andWhere('o.side = :side', { side: OrderSide.ASK })
        .andWhere('o.collectionKey IS NOT NULL')
        .getRawOne<{ count: number }>(),
      this.snapshotsRepo
        .createQueryBuilder('s')
        .where('s.cardhedgerCardId IS NOT NULL')
        .andWhere("TRIM(s.cardhedgerCardId) <> ''")
        .getCount(),
      this.ordersRepo
        .createQueryBuilder('o')
        .select('COUNT(DISTINCT o.collectionKey)::int', 'count')
        .where('o.status = :st', { st: OrderStatus.FULFILLED })
        .andWhere('o.side = :side', { side: OrderSide.ASK })
        .andWhere('o.collectionKey IS NOT NULL')
        .getRawOne<{ count: number }>(),
      this.ordersRepo.count({
        where: { status: OrderStatus.ACTIVE, side: OrderSide.ASK },
      }),
      this.ordersRepo.count({
        where: { status: OrderStatus.ACTIVE, side: OrderSide.BID },
      }),
      this.ordersRepo.count({ where: { side: OrderSide.ASK } }),
      this.ordersRepo.count({ where: { side: OrderSide.BID } }),
      this.ordersRepo.count({
        where: { status: OrderStatus.FULFILLED, side: OrderSide.ASK },
      }),
      this.ordersRepo.count({ where: { status: OrderStatus.CANCELLED } }),
      this.ordersRepo.count({ where: { status: OrderStatus.EXPIRED } }),
      this.ordersRepo
        .createQueryBuilder('o')
        .where('o.side = :side', { side: OrderSide.ASK })
        .andWhere('o.createdAt >= :since', { since })
        .getCount(),
      this.ordersRepo
        .createQueryBuilder('o')
        .where('o.side = :side', { side: OrderSide.BID })
        .andWhere('o.createdAt >= :since', { since })
        .getCount(),
      this.ordersRepo
        .createQueryBuilder('o')
        .where('o.status = :st', { st: OrderStatus.FULFILLED })
        .andWhere('o.side = :side', { side: OrderSide.ASK })
        .andWhere('o.updatedAt >= :since', { since })
        .getCount(),
      this.ordersRepo
        .createQueryBuilder('o')
        .select(this.gmvSumExpr(), 'sum')
        .where('o.status = :st', { st: OrderStatus.FULFILLED })
        .andWhere('o.side = :side', { side: OrderSide.ASK })
        .getRawOne<{ sum: string }>(),
      this.ordersRepo
        .createQueryBuilder('o')
        .select(this.gmvSumExpr(), 'sum')
        .where('o.status = :st', { st: OrderStatus.FULFILLED })
        .andWhere('o.side = :side', { side: OrderSide.ASK })
        .andWhere('o.updatedAt >= :since', { since })
        .getRawOne<{ sum: string }>(),
      this.ordersRepo
        .createQueryBuilder('o')
        .select('COUNT(DISTINCT o.offerer)::int', 'count')
        .where('o.status = :st', { st: OrderStatus.FULFILLED })
        .andWhere('o.side = :side', { side: OrderSide.ASK })
        .getRawOne<{ count: number }>(),
      this.watchlistRepo.count(),
      this.watchlistRepo
        .createQueryBuilder('w')
        .select('COUNT(DISTINCT w.userId)::int', 'count')
        .getRawOne<{ count: number }>(),
      this.watchlistRepo
        .createQueryBuilder('w')
        .select('COUNT(DISTINCT w.collectionKey)::int', 'count')
        .getRawOne<{ count: number }>(),
      this.watchlistRepo
        .createQueryBuilder('w')
        .where('w.createdAt >= :since', { since })
        .getCount(),
      this.safeCount(async () => {
        const row = await this.portfolioRepo
          .createQueryBuilder('p')
          .select('COUNT(DISTINCT p.walletAddress)::int', 'count')
          .getRawOne<{ count: number }>();
        return row?.count ?? 0;
      }),
      this.safeCount(() => this.portfolioRepo.count()),
      this.safeRawOne(async () =>
        this.portfolioRepo
          .createQueryBuilder('p')
          .select('MAX(p.snapshotDateKst)', 'max')
          .getRawOne<{ max: string | null }>(),
      ),
    ]);

    return {
      newUsers,
      linkedWallets,
      mintsTotal,
      mintsInPeriod,
      mintedWithListing: mintedWithListing?.count ?? 0,
      mintedWithSale: mintedWithSale?.count ?? 0,
      collectionsTotal,
      collectionsInPeriod,
      collectionsWithActiveListing: collectionsWithActiveListing?.count ?? 0,
      collectionsWithCardhedger,
      collectionsWithSale: collectionsWithSale?.count ?? 0,
      activeAsks,
      activeBids,
      totalAsks,
      totalBids,
      fulfilledSales,
      cancelledOrders,
      expiredOrders,
      newAsksInPeriod,
      newBidsInPeriod,
      salesInPeriod,
      gmvMicrosTotal: gmvRow?.sum ?? '0',
      gmvMicrosInPeriod: gmvPeriodRow?.sum ?? '0',
      uniqueSellers: uniqueSellersRow?.count ?? 0,
      watchlistItems,
      watchlistUsers: watchlistUsers?.count ?? 0,
      watchlistCollections: watchlistCollections?.count ?? 0,
      watchlistAddedInPeriod,
      portfolioWallets: portfolioWallets ?? 0,
      portfolioRows: portfolioRows ?? 0,
      portfolioLatestDate: portfolioLatest?.max ?? null,
    };
  }

  private async loadTimeseries(days: number, since: Date) {
    const signupsBucket = sqlDayBucket('u.createdAt');
    const mintsBucket = sqlDayBucket('t.createdAt');
    const asksBucket = sqlDayBucket('o.createdAt');
    const salesBucket = sqlDayBucket('o.updatedAt');

    const [signups, mints, newAsks, sales, gmv] = await Promise.all([
      this.usersRepo
        .createQueryBuilder('u')
        .select(signupsBucket, 'day')
        .addSelect('COUNT(*)::int', 'count')
        .where('u.createdAt >= :since', { since })
        .groupBy(signupsBucket)
        .orderBy(signupsBucket, 'ASC')
        .getRawMany<{ day: string; count: string }>(),
      this.rwaRepo
        .createQueryBuilder('t')
        .select(mintsBucket, 'day')
        .addSelect('COUNT(*)::int', 'count')
        .where('t.createdAt >= :since', { since })
        .groupBy(mintsBucket)
        .orderBy(mintsBucket, 'ASC')
        .getRawMany<{ day: string; count: string }>(),
      this.ordersRepo
        .createQueryBuilder('o')
        .select(asksBucket, 'day')
        .addSelect('COUNT(*)::int', 'count')
        .where('o.createdAt >= :since', { since })
        .andWhere('o.side = :side', { side: OrderSide.ASK })
        .groupBy(asksBucket)
        .orderBy(asksBucket, 'ASC')
        .getRawMany<{ day: string; count: string }>(),
      this.ordersRepo
        .createQueryBuilder('o')
        .select(salesBucket, 'day')
        .addSelect('COUNT(*)::int', 'count')
        .where('o.updatedAt >= :since', { since })
        .andWhere('o.status = :st', { st: OrderStatus.FULFILLED })
        .andWhere('o.side = :side', { side: OrderSide.ASK })
        .groupBy(salesBucket)
        .orderBy(salesBucket, 'ASC')
        .getRawMany<{ day: string; count: string }>(),
      this.ordersRepo
        .createQueryBuilder('o')
        .select(salesBucket, 'day')
        .addSelect(this.gmvSumExpr(), 'amount')
        .where('o.updatedAt >= :since', { since })
        .andWhere('o.status = :st', { st: OrderStatus.FULFILLED })
        .andWhere('o.side = :side', { side: OrderSide.ASK })
        .groupBy(salesBucket)
        .orderBy(salesBucket, 'ASC')
        .getRawMany<{ day: string; amount: string }>(),
    ]);

    return {
      signups: fillDailyCounts(signups, days),
      mints: fillDailyCounts(mints, days),
      newAsks: fillDailyCounts(newAsks, days),
      sales: fillDailyCounts(sales, days),
      gmvUsdc: fillDailyAmounts(gmv, days),
    };
  }

  private async loadTopCollections() {
    const [byActiveListings, bySales, byGmv, byWatchlist] = await Promise.all([
      this.ordersRepo
        .createQueryBuilder('o')
        .select('o.collectionKey', 'collectionKey')
        .addSelect('COUNT(*)::int', 'cnt')
        .where('o.status = :st', { st: OrderStatus.ACTIVE })
        .andWhere('o.side = :side', { side: OrderSide.ASK })
        .andWhere('o.collectionKey IS NOT NULL')
        .groupBy('o.collectionKey')
        .orderBy('COUNT(*)', 'DESC')
        .limit(10)
        .getRawMany<{ collectionKey: string; cnt: number }>(),
      this.ordersRepo
        .createQueryBuilder('o')
        .select('o.collectionKey', 'collectionKey')
        .addSelect('COUNT(*)::int', 'cnt')
        .where('o.status = :st', { st: OrderStatus.FULFILLED })
        .andWhere('o.side = :side', { side: OrderSide.ASK })
        .andWhere('o.collectionKey IS NOT NULL')
        .groupBy('o.collectionKey')
        .orderBy('COUNT(*)', 'DESC')
        .limit(10)
        .getRawMany<{ collectionKey: string; cnt: number }>(),
      this.ordersRepo
        .createQueryBuilder('o')
        .select('o.collectionKey', 'collectionKey')
        .addSelect('COUNT(*)::int', 'cnt')
        .addSelect(this.gmvSumExpr(), 'gmvMicros')
        .where('o.status = :st', { st: OrderStatus.FULFILLED })
        .andWhere('o.side = :side', { side: OrderSide.ASK })
        .andWhere('o.collectionKey IS NOT NULL')
        .groupBy('o.collectionKey')
        .orderBy(this.gmvSumExpr(), 'DESC')
        .limit(10)
        .getRawMany<{
          collectionKey: string;
          cnt: number;
          gmvMicros: string;
        }>(),
      this.watchlistRepo
        .createQueryBuilder('w')
        .select('w.collectionKey', 'collectionKey')
        .addSelect('COUNT(*)::int', 'cnt')
        .groupBy('w.collectionKey')
        .orderBy('COUNT(*)', 'DESC')
        .limit(10)
        .getRawMany<{ collectionKey: string; cnt: number }>(),
    ]);

    const labelMap = await this.collectionLabelMap([
      ...byActiveListings.map((r) => r.collectionKey),
      ...bySales.map((r) => r.collectionKey),
      ...byGmv.map((r) => r.collectionKey),
      ...byWatchlist.map((r) => r.collectionKey),
    ]);

    const mapTop = (
      rows: { collectionKey: string; cnt: number; gmvMicros?: string }[],
      withGmv = false,
    ): TopCollectionRow[] =>
      rows.map((r) => ({
        collectionKey: r.collectionKey,
        displayLabel: labelMap.get(r.collectionKey) ?? null,
        count: Number(r.cnt) || 0,
        ...(withGmv ? { gmvUsdc: microsToUsdc(r.gmvMicros) } : {}),
      }));

    return {
      byActiveListings: mapTop(byActiveListings),
      bySales: mapTop(bySales),
      byWatchlist: mapTop(byWatchlist),
      byGmv: mapTop(byGmv, true),
    };
  }

  private async loadRecentTrades(): Promise<RecentTradeRow[]> {
    const rows = await this.ordersRepo
      .createQueryBuilder('o')
      .select('o.orderHash', 'orderHash')
      .addSelect('o.tokenId', 'tokenId')
      .addSelect('o.collectionKey', 'collectionKey')
      .addSelect('o.considerationAmount', 'considerationAmount')
      .addSelect('o.updatedAt', 'fulfilledAt')
      .where('o.status = :st', { st: OrderStatus.FULFILLED })
      .andWhere('o.side = :side', { side: OrderSide.ASK })
      .orderBy('o.updatedAt', 'DESC')
      .limit(20)
      .getRawMany<{
        orderHash: string;
        tokenId: string;
        collectionKey: string | null;
        considerationAmount: string;
        fulfilledAt: Date | string;
      }>();

    const labelMap = await this.collectionLabelMap(
      rows
        .map((r) => r.collectionKey)
        .filter((k): k is string => Boolean(k)),
    );

    return rows.map((r) => ({
      orderHash: r.orderHash,
      tokenId: r.tokenId,
      collectionKey: r.collectionKey,
      displayLabel: r.collectionKey
        ? (labelMap.get(r.collectionKey) ?? null)
        : null,
      priceUsdc: microsToUsdc(r.considerationAmount),
      fulfilledAt: this.toIsoTimestamp(r.fulfilledAt),
    }));
  }

  private async loadOrdersBreakdown(): Promise<OrderBreakdownRow[]> {
    const rows = await this.ordersRepo
      .createQueryBuilder('o')
      .select('o.side', 'side')
      .addSelect('o.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('o.side')
      .addGroupBy('o.status')
      .orderBy('o.side', 'ASC')
      .addOrderBy('o.status', 'ASC')
      .getRawMany<{ side: string; status: string; count: number }>();

    return rows.map((r) => ({
      side: r.side,
      status: r.status,
      count: Number(r.count) || 0,
    }));
  }

  private gmvSumExpr(): string {
    return `COALESCE(SUM(NULLIF(TRIM(o.considerationAmount), '')::numeric), 0)`;
  }

  private async safeCount(fn: () => Promise<number>): Promise<number> {
    try {
      return await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Analytics count skipped: ${message}`);
      return 0;
    }
  }

  private async safeRawOne<T>(fn: () => Promise<T | undefined>): Promise<T | null> {
    try {
      const row = await fn();
      return row ?? null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Analytics aggregate skipped: ${message}`);
      return null;
    }
  }

  private async collectionLabelMap(
    keys: string[],
  ): Promise<Map<string, string>> {
    const unique = [...new Set(keys.filter(Boolean))];
    if (unique.length === 0) return new Map();
    const rows = await this.collectionsRepo.find({
      where: { collectionKey: In(unique) },
      select: ['collectionKey', 'displayLabel'],
    });
    return new Map(rows.map((r) => [r.collectionKey, r.displayLabel]));
  }

  private toIsoTimestamp(value: Date | string | null | undefined): string {
    if (value == null) return new Date(0).toISOString();
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime())
      ? new Date(0).toISOString()
      : d.toISOString();
  }
}
