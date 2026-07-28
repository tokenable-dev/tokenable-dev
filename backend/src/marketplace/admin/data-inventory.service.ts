import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CardhedgerDailyPriceExportRun } from '../../cardhedger/entities/cardhedger-daily-price-export-run.entity';
import { CardhedgerPriceDeltaCheckpoint } from '../../cardhedger/entities/cardhedger-price-delta-checkpoint.entity';
import { CardhedgerPriceDeltaImportRun } from '../../cardhedger/entities/cardhedger-price-delta-import-run.entity';
import { CardhedgerPriceSubscription } from '../../cardhedger/entities/cardhedger-price-subscription.entity';
import { CardTop100DailySnapshot } from '../../cardhedger/entities/card-top100-snapshot.entity';
import { BulkMintJobItem } from '../../rwa/entities/bulk-mint-job-item.entity';
import { BulkMintJob } from '../../rwa/entities/bulk-mint-job.entity';
import { UserKycEvent } from '../../user/entities/user-kyc-event.entity';
import { UserWallet } from '../../user/entities/user-wallet.entity';
import { User } from '../../user/entities/user.entity';
import { VaultAsset } from '../../vault/entities/vault-asset.entity';
import { VaultCycle } from '../../vault/entities/vault-cycle.entity';
import { VaultRedemption } from '../../vault/entities/vault-redemption.entity';
import { VaultSubmissionItem } from '../../vault/entities/vault-submission-item.entity';
import { VaultSubmission } from '../../vault/entities/vault-submission.entity';
import {
  CollectionMarketSnapshot,
  type CollectionMarketSnapshotState,
} from '../entities/collection-market-snapshot.entity';
import { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import { MarketplacePartner } from '../entities/marketplace-partner.entity';
import { Order } from '../entities/order.entity';
import { P2pListing } from '../entities/p2p-listing.entity';
import { P2pOrder } from '../entities/p2p-order.entity';
import { PortfolioDailySnapshot } from '../entities/portfolio-daily-snapshot.entity';
import { PortfolioHolding } from '../entities/portfolio-holding.entity';
import { RwaToken } from '../entities/rwa-token.entity';
import { UserWatchlist } from '../entities/user-watchlist.entity';
import {
  DATA_INVENTORY_DOMAINS,
  DATA_STORE_CATALOG,
  type DataInventoryDomainId,
  type DataStoreCatalogEntry,
} from './data-inventory.catalog';

export type DataStoreStats = {
  rowCount: number;
  oldestAt: string | null;
  newestAt: string | null;
  lastActivityAt: string | null;
  highlights: Record<string, string | number | boolean | null>;
};

export type DataStoreInventoryRow = DataStoreCatalogEntry & DataStoreStats;

export type DataInventoryResponse = {
  generatedAt: string;
  domains: typeof DATA_INVENTORY_DOMAINS;
  stores: DataStoreInventoryRow[];
  totals: {
    storeCount: number;
    rowCount: number;
  };
};

type TableStats = {
  rowCount: number;
  oldestAt: Date | string | null;
  newestAt: Date | string | null;
  lastActivityAt: Date | string | null;
};

@Injectable()
export class DataInventoryService {
  private readonly logger = new Logger(DataInventoryService.name);

  constructor(
    @InjectRepository(MarketplaceCollection)
    private readonly collectionsRepo: Repository<MarketplaceCollection>,
    @InjectRepository(RwaToken)
    private readonly rwaRepo: Repository<RwaToken>,
    @InjectRepository(BulkMintJob)
    private readonly bulkMintJobsRepo: Repository<BulkMintJob>,
    @InjectRepository(BulkMintJobItem)
    private readonly bulkMintItemsRepo: Repository<BulkMintJobItem>,
    @InjectRepository(MarketplacePartner)
    private readonly partnersRepo: Repository<MarketplacePartner>,
    @InjectRepository(CollectionMarketSnapshot)
    private readonly marketSnapshotsRepo: Repository<CollectionMarketSnapshot>,
    @InjectRepository(CardTop100DailySnapshot)
    private readonly top100Repo: Repository<CardTop100DailySnapshot>,
    @InjectRepository(CardhedgerPriceDeltaImportRun)
    private readonly deltaRunsRepo: Repository<CardhedgerPriceDeltaImportRun>,
    @InjectRepository(CardhedgerPriceDeltaCheckpoint)
    private readonly deltaCheckpointRepo: Repository<CardhedgerPriceDeltaCheckpoint>,
    @InjectRepository(CardhedgerPriceSubscription)
    private readonly priceSubscriptionsRepo: Repository<CardhedgerPriceSubscription>,
    @InjectRepository(CardhedgerDailyPriceExportRun)
    private readonly exportRunsRepo: Repository<CardhedgerDailyPriceExportRun>,
    @InjectRepository(PortfolioDailySnapshot)
    private readonly portfolioSnapshotsRepo: Repository<PortfolioDailySnapshot>,
    @InjectRepository(PortfolioHolding)
    private readonly portfolioHoldingsRepo: Repository<PortfolioHolding>,
    @InjectRepository(UserWatchlist)
    private readonly watchlistRepo: Repository<UserWatchlist>,
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
    @InjectRepository(P2pOrder)
    private readonly p2pOrdersRepo: Repository<P2pOrder>,
    @InjectRepository(P2pListing)
    private readonly p2pListingsRepo: Repository<P2pListing>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(UserWallet)
    private readonly walletsRepo: Repository<UserWallet>,
    @InjectRepository(UserKycEvent)
    private readonly kycEventsRepo: Repository<UserKycEvent>,
    @InjectRepository(VaultAsset)
    private readonly vaultAssetsRepo: Repository<VaultAsset>,
    @InjectRepository(VaultCycle)
    private readonly vaultCyclesRepo: Repository<VaultCycle>,
    @InjectRepository(VaultRedemption)
    private readonly vaultRedemptionsRepo: Repository<VaultRedemption>,
    @InjectRepository(VaultSubmission)
    private readonly vaultSubmissionsRepo: Repository<VaultSubmission>,
    @InjectRepository(VaultSubmissionItem)
    private readonly vaultSubmissionItemsRepo: Repository<VaultSubmissionItem>,
  ) {}

  async getInventory(): Promise<DataInventoryResponse> {
    const statsById = await this.loadAllStats();
    const stores: DataStoreInventoryRow[] = DATA_STORE_CATALOG.map((entry) => {
      const stats = statsById.get(entry.id) ?? emptyStats();
      return { ...entry, ...stats };
    });

    return {
      generatedAt: new Date().toISOString(),
      domains: DATA_INVENTORY_DOMAINS,
      stores,
      totals: {
        storeCount: stores.length,
        rowCount: stores.reduce((sum, s) => sum + s.rowCount, 0),
      },
    };
  }

  private async loadAllStats(): Promise<Map<string, DataStoreStats>> {
    const results = await Promise.all([
      this.loadSimple('marketplace_collections', this.collectionsRepo, {
        oldest: 'createdAt',
        newest: 'createdAt',
        lastActivity: 'createdAt',
      }),
      this.loadSimple('rwa_tokens', this.rwaRepo, {
        oldest: 'createdAt',
        newest: 'createdAt',
        lastActivity: 'createdAt',
      }),
      this.loadSimple('bulk_mint_jobs', this.bulkMintJobsRepo, {
        oldest: 'createdAt',
        newest: 'updatedAt',
        lastActivity: 'updatedAt',
      }),
      this.loadSimple('bulk_mint_job_items', this.bulkMintItemsRepo, {
        oldest: 'createdAt',
        newest: 'updatedAt',
        lastActivity: 'updatedAt',
      }),
      this.loadSimple('marketplace_partners', this.partnersRepo, {
        oldest: 'createdAt',
        newest: 'updatedAt',
        lastActivity: 'updatedAt',
      }),
      this.loadMarketSnapshots(),
      this.loadTop100Snapshots(),
      this.loadSimple('cardhedger_price_delta_import_runs', this.deltaRunsRepo, {
        oldest: 'ranAt',
        newest: 'ranAt',
        lastActivity: 'ranAt',
      }),
      this.loadDeltaCheckpoint(),
      this.loadPriceSubscriptions(),
      this.loadSimple('cardhedger_daily_price_export_runs', this.exportRunsRepo, {
        oldest: 'ranAt',
        newest: 'ranAt',
        lastActivity: 'ranAt',
      }),
      this.loadPortfolioSnapshots(),
      this.loadSimple('portfolio_holdings', this.portfolioHoldingsRepo, {
        oldest: 'createdAt',
        newest: 'updatedAt',
        lastActivity: 'updatedAt',
      }),
      this.loadSimple('user_watchlist', this.watchlistRepo, {
        oldest: 'createdAt',
        newest: 'createdAt',
        lastActivity: 'createdAt',
      }),
      this.loadSimple('orders', this.ordersRepo, {
        oldest: 'createdAt',
        newest: 'updatedAt',
        lastActivity: 'updatedAt',
      }),
      this.loadSimple('p2p_orders', this.p2pOrdersRepo, {
        oldest: 'createdAt',
        newest: 'updatedAt',
        lastActivity: 'updatedAt',
      }),
      this.loadSimple('p2p_listings', this.p2pListingsRepo, {
        oldest: 'createdAt',
        newest: 'updatedAt',
        lastActivity: 'updatedAt',
      }),
      this.loadSimple('users', this.usersRepo, {
        oldest: 'createdAt',
        newest: 'createdAt',
        lastActivity: 'createdAt',
      }),
      this.loadSimple('user_wallets', this.walletsRepo, {
        oldest: 'linkedAt',
        newest: 'updatedAt',
        lastActivity: 'updatedAt',
      }),
      this.loadSimple('user_kyc_events', this.kycEventsRepo, {
        oldest: 'createdAt',
        newest: 'createdAt',
        lastActivity: 'createdAt',
      }),
      this.loadSimple('vault_assets', this.vaultAssetsRepo, {
        oldest: 'createdAt',
        newest: 'updatedAt',
        lastActivity: 'updatedAt',
      }),
      this.loadSimple('vault_cycles', this.vaultCyclesRepo, {
        oldest: 'createdAt',
        newest: 'updatedAt',
        lastActivity: 'updatedAt',
      }),
      this.loadSimple('vault_redemptions', this.vaultRedemptionsRepo, {
        oldest: 'createdAt',
        newest: 'createdAt',
        lastActivity: 'createdAt',
      }),
      this.loadSimple('vault_submissions', this.vaultSubmissionsRepo, {
        oldest: 'createdAt',
        newest: 'updatedAt',
        lastActivity: 'updatedAt',
      }),
      this.loadSimple('vault_submission_items', this.vaultSubmissionItemsRepo, {
        oldest: 'createdAt',
        newest: 'updatedAt',
        lastActivity: 'updatedAt',
      }),
    ]);

    return new Map(results);
  }

  private async loadSimple(
    id: string,
    repo: Repository<any>,
    columns: {
      oldest: string;
      newest: string;
      lastActivity: string;
    },
  ): Promise<[string, DataStoreStats]> {
    try {
      const alias = 'row';
      const oldestCol = `${alias}.${columns.oldest}`;
      const newestCol = `${alias}.${columns.newest}`;
      const lastCol = `${alias}.${columns.lastActivity}`;

      const row = await repo
        .createQueryBuilder(alias)
        .select('COUNT(*)::int', 'rowCount')
        .addSelect(`MIN(${oldestCol})`, 'oldestAt')
        .addSelect(`MAX(${newestCol})`, 'newestAt')
        .addSelect(`MAX(${lastCol})`, 'lastActivityAt')
        .getRawOne<{
          rowCount: number;
          oldestAt: Date | string | null;
          newestAt: Date | string | null;
          lastActivityAt: Date | string | null;
        }>();

      return [
        id,
        this.toStats(
          row ?? {
            rowCount: 0,
            oldestAt: null,
            newestAt: null,
            lastActivityAt: null,
          },
        ),
      ];
    } catch (err) {
      this.logSkip(id, err);
      return [id, emptyStats()];
    }
  }

  private async loadMarketSnapshots(): Promise<[string, DataStoreStats]> {
    const id = 'collection_market_snapshots';
    try {
      const [aggregate, stateRows, withCardhedger] = await Promise.all([
        this.marketSnapshotsRepo
          .createQueryBuilder('s')
          .select('COUNT(*)::int', 'rowCount')
          .addSelect('MIN(s.createdAt)', 'oldestAt')
          .addSelect('MAX(s.syncedAt)', 'newestAt')
          .addSelect('MAX(s.updatedAt)', 'lastActivityAt')
          .getRawOne<TableStats>(),
        this.marketSnapshotsRepo
          .createQueryBuilder('s')
          .select('s.marketState', 'state')
          .addSelect('COUNT(*)::int', 'count')
          .groupBy('s.marketState')
          .getRawMany<{ state: CollectionMarketSnapshotState; count: number }>(),
        this.marketSnapshotsRepo
          .createQueryBuilder('s')
          .where('s.cardhedgerCardId IS NOT NULL')
          .andWhere("TRIM(s.cardhedgerCardId) <> ''")
          .getCount(),
      ]);

      const byState = Object.fromEntries(
        stateRows.map((r) => [r.state, Number(r.count) || 0]),
      ) as Record<string, number>;

      return [
        id,
        {
          ...this.toStats(aggregate ?? emptyTableStats()),
          highlights: {
            withCardhedgerId: withCardhedger,
            fresh: byState.fresh ?? 0,
            stale: byState.stale ?? 0,
            error: byState.error ?? 0,
            empty: byState.empty ?? 0,
          },
        },
      ];
    } catch (err) {
      this.logSkip(id, err);
      return [id, emptyStats()];
    }
  }

  private async loadTop100Snapshots(): Promise<[string, DataStoreStats]> {
    const id = 'card_top100_daily_snapshots';
    try {
      const [aggregate, distinctDates, distinctCategories, latestRow] =
        await Promise.all([
          this.top100Repo
            .createQueryBuilder('t')
            .select('COUNT(*)::int', 'rowCount')
            .addSelect('MIN(t.snapshotDateKst)', 'oldestAt')
            .addSelect('MAX(t.snapshotDateKst)', 'newestAt')
            .addSelect('MAX(t.fetchedAt)', 'lastActivityAt')
            .getRawOne<TableStats>(),
          this.top100Repo
            .createQueryBuilder('t')
            .select('COUNT(DISTINCT t.snapshotDateKst)::int', 'count')
            .getRawOne<{ count: number }>(),
          this.top100Repo
            .createQueryBuilder('t')
            .select('COUNT(DISTINCT t.category)::int', 'count')
            .getRawOne<{ count: number }>(),
          this.top100Repo.findOne({
            order: { snapshotDateKst: 'DESC', fetchedAt: 'DESC' },
          }),
        ]);

      return [
        id,
        {
          rowCount: aggregate?.rowCount ?? 0,
          oldestAt: this.isoDate(aggregate?.oldestAt),
          newestAt: this.isoDate(aggregate?.newestAt),
          lastActivityAt: this.isoTimestamp(aggregate?.lastActivityAt),
          highlights: {
            distinctSnapshotDates: distinctDates?.count ?? 0,
            distinctCategories: distinctCategories?.count ?? 0,
            latestSnapshotDateKst: latestRow?.snapshotDateKst ?? null,
            latestGrade: latestRow?.grade ?? null,
            cardsInLatestRow: latestRow?.cardsJson?.length ?? null,
          },
        },
      ];
    } catch (err) {
      this.logSkip(id, err);
      return [id, emptyStats()];
    }
  }

  private async loadPortfolioSnapshots(): Promise<[string, DataStoreStats]> {
    const id = 'portfolio_daily_snapshots';
    try {
      const [aggregate, wallets] = await Promise.all([
        this.portfolioSnapshotsRepo
          .createQueryBuilder('p')
          .select('COUNT(*)::int', 'rowCount')
          .addSelect('MIN(p.snapshotDateKst)', 'oldestAt')
          .addSelect('MAX(p.snapshotDateKst)', 'newestAt')
          .addSelect('MAX(p.createdAt)', 'lastActivityAt')
          .getRawOne<TableStats>(),
        this.portfolioSnapshotsRepo
          .createQueryBuilder('p')
          .select('COUNT(DISTINCT p.walletAddress)::int', 'count')
          .getRawOne<{ count: number }>(),
      ]);

      return [
        id,
        {
          rowCount: aggregate?.rowCount ?? 0,
          oldestAt: this.isoDate(aggregate?.oldestAt),
          newestAt: this.isoDate(aggregate?.newestAt),
          lastActivityAt: this.isoTimestamp(aggregate?.lastActivityAt),
          highlights: {
            trackedWallets: wallets?.count ?? 0,
            latestSnapshotDateKst: this.isoDate(aggregate?.newestAt),
          },
        },
      ];
    } catch (err) {
      this.logSkip(id, err);
      return [id, emptyStats()];
    }
  }

  private async loadPriceSubscriptions(): Promise<[string, DataStoreStats]> {
    const id = 'cardhedger_price_subscriptions';
    try {
      const [aggregate, active] = await Promise.all([
        this.priceSubscriptionsRepo
          .createQueryBuilder('s')
          .select('COUNT(*)::int', 'rowCount')
          .addSelect('MIN(s.subscribedAt)', 'oldestAt')
          .addSelect(
            'MAX(COALESCE(s.lastWebhookAt, s.subscribedAt))',
            'lastActivityAt',
          )
          .getRawOne<TableStats>(),
        this.priceSubscriptionsRepo.count({ where: { active: true } }),
      ]);

      const lastActivityAt = this.isoTimestamp(aggregate?.lastActivityAt);
      return [
        id,
        {
          rowCount: aggregate?.rowCount ?? 0,
          oldestAt: this.isoTimestamp(aggregate?.oldestAt),
          newestAt: lastActivityAt,
          lastActivityAt,
          highlights: { activeSubscriptions: active },
        },
      ];
    } catch (err) {
      this.logSkip(id, err);
      return [id, emptyStats()];
    }
  }

  private async loadDeltaCheckpoint(): Promise<[string, DataStoreStats]> {
    const id = 'cardhedger_price_delta_checkpoints';
    try {
      const row = await this.deltaCheckpointRepo.findOne({ where: { id: 1 } });
      return [
        id,
        {
          rowCount: row ? 1 : 0,
          oldestAt: row ? row.updatedAt.toISOString() : null,
          newestAt: row ? row.updatedAt.toISOString() : null,
          lastActivityAt: row ? row.updatedAt.toISOString() : null,
          highlights: {
            lastSinceIso: row?.lastSinceIso ?? null,
          },
        },
      ];
    } catch (err) {
      this.logSkip(id, err);
      return [id, emptyStats()];
    }
  }

  private toStats(row: TableStats): DataStoreStats {
    return {
      rowCount: Number(row.rowCount) || 0,
      oldestAt: this.isoTimestamp(row.oldestAt),
      newestAt: this.isoTimestamp(row.newestAt),
      lastActivityAt: this.isoTimestamp(row.lastActivityAt),
      highlights: {},
    };
  }

  private isoTimestamp(value: Date | string | null | undefined): string | null {
    if (value == null) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  private isoDate(value: Date | string | null | undefined): string | null {
    if (value == null) return null;
    if (typeof value === 'string') return value.slice(0, 10);
    return value.toISOString().slice(0, 10);
  }

  private logSkip(id: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.warn(`Data inventory skipped ${id}: ${message}`);
  }
}

function emptyTableStats(): TableStats {
  return { rowCount: 0, oldestAt: null, newestAt: null, lastActivityAt: null };
}

function emptyStats(): DataStoreStats {
  return { rowCount: 0, oldestAt: null, newestAt: null, lastActivityAt: null, highlights: {} };
}

export type { DataInventoryDomainId };
