import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { createHash, timingSafeEqual } from 'crypto';
import { DataSource, Repository } from 'typeorm';
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
import {
  DATA_INVENTORY_LOGICAL_EDGES,
  type SchemaEdgeKind,
} from './data-inventory.schema';

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

export type DataInventorySchemaColumn = {
  name: string;
  dataType: string;
  primaryKey: boolean;
  unique: boolean;
  foreignKey: boolean;
};

export type DataInventorySchemaTable = {
  table: string;
  label: string;
  domain: DataInventoryDomainId;
  rowCount: number;
  columns: DataInventorySchemaColumn[];
};

export type DataInventorySchemaEdge = {
  id: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  kind: SchemaEdgeKind;
  label: string;
};

export type DataInventorySchemaResponse = {
  generatedAt: string;
  tables: DataInventorySchemaTable[];
  edges: DataInventorySchemaEdge[];
};

/** Mirrors `sql/maintenance/reset_marketplace_data.sql` (required tables). */
const RESET_REQUIRED_TABLES = [
  'marketplace_notifications',
  'p2p_orders',
  'p2p_listings',
  'bulk_mint_job_items',
  'bulk_mint_jobs',
  'portfolio_holdings',
  'orders',
  'self_vault_settlements',
  'rwa_tokens',
  'rwa_owner_index_cursors',
  'collection_market_snapshots',
  'cardhedger_price_subscriptions',
  'marketplace_collections',
  'user_watchlist',
  'user_buyer_listing_alert',
  'portfolio_daily_snapshots',
  'vault_redemptions',
  'vault_redeem_payment_claims',
  'vault_submission_items',
  'vault_submissions',
  'vault_cycles',
  'vault_assets',
] as const;

const RESET_OPTIONAL_TABLES = [
  'vault_psa_arrival_reviews',
  'vault_psa_vaulted_reviews',
] as const;

export type AdminMarketplaceResetResult = {
  truncatedTables: string[];
  skippedMissingTables: string[];
  rowCountsBefore: Record<string, number>;
};

export type AdminDataInventoryRowsResult = {
  table: string;
  label: string;
  description: string | null;
  domain: DataInventoryDomainId;
  columns: string[];
  redactedColumns: string[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  rows: Record<string, unknown>[];
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
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  /**
   * Dev/staging only — same wipe as `sql/maintenance/reset_marketplace_data.sql`.
   * Keeps users, admins, partners, and Cardhedger infra audit tables.
   * Call after updating RWA env addresses to a freshly deployed contract.
   */
  async resetForNewContract(
    password: string,
  ): Promise<AdminMarketplaceResetResult> {
    const isProduction =
      this.config.get<boolean>('app.isProduction') ??
      this.config.get<string>('NODE_ENV') === 'production';
    if (isProduction) {
      throw new ForbiddenException(
        'Marketplace reset for new contract is disabled in production',
      );
    }

    const expected =
      this.config.get<string>('marketplace.adminDbResetPassword')?.trim() ||
      '';
    if (!expected || !passwordMatchesResetGate(password, expected)) {
      throw new UnauthorizedException('Invalid reset password');
    }

    const rowCountsBefore: Record<string, number> = {};
    const truncatedTables: string[] = [];
    const skippedMissingTables: string[] = [];

    for (const table of RESET_REQUIRED_TABLES) {
      const exists = await this.tableExists(table);
      if (!exists) {
        skippedMissingTables.push(table);
        continue;
      }
      rowCountsBefore[table] = await this.countRows(table);
    }
    for (const table of RESET_OPTIONAL_TABLES) {
      const exists = await this.tableExists(table);
      if (!exists) {
        skippedMissingTables.push(table);
        continue;
      }
      rowCountsBefore[table] = await this.countRows(table);
    }

    const requiredPresent = RESET_REQUIRED_TABLES.filter(
      (t) => !skippedMissingTables.includes(t),
    );
    if (requiredPresent.length === 0) {
      throw new ForbiddenException('No marketplace tables found to truncate');
    }

    await this.dataSource.transaction(async (manager) => {
      const list = requiredPresent.map((t) => `"${t}"`).join(', ');
      await manager.query(
        `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`,
      );
      truncatedTables.push(...requiredPresent);

      for (const table of RESET_OPTIONAL_TABLES) {
        if (skippedMissingTables.includes(table)) continue;
        await manager.query(
          `TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`,
        );
        truncatedTables.push(table);
      }
    });

    const result: AdminMarketplaceResetResult = {
      truncatedTables,
      skippedMissingTables,
      rowCountsBefore,
    };
    this.logger.warn(
      JSON.stringify({ msg: 'admin_marketplace_reset_for_new_contract', ...result }),
    );
    return result;
  }

  private async tableExists(table: string): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT to_regclass($1) AS reg`,
      [`public.${table}`],
    );
    return rows?.[0]?.reg != null;
  }

  private async countRows(table: string): Promise<number> {
    const rows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS n FROM "${table}"`,
    );
    return Number(rows?.[0]?.n ?? 0);
  }

  /**
   * Paginated raw rows for any public table (admin browse).
   * Table name must be snake_case and exist in `public`.
   */
  async getTableRows(
    table: string,
    page: number,
    pageSize: number,
  ): Promise<AdminDataInventoryRowsResult> {
    const safe = table.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]*$/.test(safe)) {
      throw new BadRequestException('Invalid table name');
    }
    if (!(await this.tableExists(safe))) {
      throw new NotFoundException(`Table not found: ${safe}`);
    }

    const total = await this.countRows(safe);
    const columns = await this.listColumns(safe);
    const orderCol = pickOrderColumn(columns);
    const offset = (page - 1) * pageSize;
    const rawRows: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT * FROM "${safe}" ORDER BY ${orderCol} LIMIT $1 OFFSET $2`,
      [pageSize, offset],
    );

    const rows = rawRows.map((row) => redactRow(row));
    const catalog = DATA_STORE_CATALOG.find((s) => s.table === safe);

    return {
      table: safe,
      label: catalog?.label ?? safe,
      description: catalog?.description ?? null,
      domain: catalog?.domain ?? 'other',
      columns: columns.map((c) => c.column_name),
      redactedColumns: columns
        .map((c) => c.column_name)
        .filter((name) => isSensitiveColumn(name)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      rows,
    };
  }

  async getInventory(): Promise<DataInventoryResponse> {
    const statsById = await this.loadAllStats();
    const catalogStores: DataStoreInventoryRow[] = DATA_STORE_CATALOG.map(
      (entry) => {
        const stats = statsById.get(entry.id) ?? emptyStats();
        return { ...entry, ...stats };
      },
    );

    const catalogTables = new Set(DATA_STORE_CATALOG.map((s) => s.table));
    const publicTables = await this.listPublicTables();
    const extraStores: DataStoreInventoryRow[] = [];

    for (const table of publicTables) {
      if (catalogTables.has(table)) continue;
      if (table.startsWith('pg_') || table === 'spatial_ref_sys') continue;
      try {
        const rowCount = await this.countRows(table);
        extraStores.push({
          id: table,
          table,
          domain: 'other',
          label: table,
          description:
            '카탈로그 미등록 public 테이블입니다. 아래 「행 보기」로 전체 내용을 확인할 수 있습니다.',
          howAccumulated: '스키마에 존재하는 모든 public 테이블을 자동 수집합니다.',
          adminPagePath: null,
          rowCount,
          oldestAt: null,
          newestAt: null,
          lastActivityAt: null,
          highlights: {},
        });
      } catch (err) {
        this.logSkip(table, err);
      }
    }

    extraStores.sort((a, b) => a.table.localeCompare(b.table));
    const stores = [...catalogStores, ...extraStores];

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

  async getSchema(): Promise<DataInventorySchemaResponse> {
    const publicTables = await this.listPublicTables();
    const tableSet = new Set(publicTables);
    const catalogByTable = new Map(DATA_STORE_CATALOG.map((s) => [s.table, s]));
    const rowCounts = new Map<string, number>();
    for (const table of publicTables) {
      try {
        rowCounts.set(table, await this.countRows(table));
      } catch {
        rowCounts.set(table, 0);
      }
    }

    const columnsByTable = new Map<string, DataInventorySchemaColumn[]>();
    for (const table of publicTables) {
      const cols = await this.listColumns(table);
      columnsByTable.set(
        table,
        cols.map((c) => ({
          name: c.column_name,
          dataType: c.data_type,
          primaryKey: false,
          unique: false,
          foreignKey: false,
        })),
      );
    }

    const keyRows = (await this.dataSource.query(
      `SELECT tc.table_name, kcu.column_name, tc.constraint_type
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_schema = kcu.constraint_schema
        AND tc.constraint_name = kcu.constraint_name
       WHERE tc.table_schema = 'public'
         AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY')`,
    )) as {
      table_name: string;
      column_name: string;
      constraint_type: string;
    }[];

    for (const row of keyRows) {
      const cols = columnsByTable.get(row.table_name);
      const col = cols?.find((c) => c.name === row.column_name);
      if (!col) continue;
      if (row.constraint_type === 'PRIMARY KEY') col.primaryKey = true;
      if (row.constraint_type === 'UNIQUE') col.unique = true;
      if (row.constraint_type === 'FOREIGN KEY') col.foreignKey = true;
    }

    const fkRows = (await this.dataSource.query(
      `SELECT
         kcu.table_name AS from_table,
         kcu.column_name AS from_column,
         ccu.table_name AS to_table,
         ccu.column_name AS to_column
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_schema = kcu.constraint_schema
        AND tc.constraint_name = kcu.constraint_name
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_schema = tc.constraint_schema
        AND ccu.constraint_name = tc.constraint_name
       WHERE tc.table_schema = 'public'
         AND tc.constraint_type = 'FOREIGN KEY'`,
    )) as {
      from_table: string;
      from_column: string;
      to_table: string;
      to_column: string;
    }[];

    const edges: DataInventorySchemaEdge[] = [];
    const seen = new Set<string>();

    const pushEdge = (edge: DataInventorySchemaEdge) => {
      if (!tableSet.has(edge.fromTable) || !tableSet.has(edge.toTable)) return;
      if (seen.has(edge.id)) return;
      seen.add(edge.id);
      edges.push(edge);
    };

    for (const fk of fkRows) {
      pushEdge({
        id: `fk:${fk.from_table}.${fk.from_column}->${fk.to_table}.${fk.to_column}`,
        fromTable: fk.from_table,
        fromColumn: fk.from_column,
        toTable: fk.to_table,
        toColumn: fk.to_column,
        kind: 'fk',
        label: fk.from_column,
      });
    }

    for (const logical of DATA_INVENTORY_LOGICAL_EDGES) {
      pushEdge({
        id: `logical:${logical.fromTable}.${logical.fromColumn}->${logical.toTable}.${logical.toColumn}`,
        fromTable: logical.fromTable,
        fromColumn: logical.fromColumn,
        toTable: logical.toTable,
        toColumn: logical.toColumn,
        kind: 'logical',
        label: logical.label,
      });
    }

    const tables: DataInventorySchemaTable[] = publicTables.map((table) => {
      const catalog = catalogByTable.get(table);
      return {
        table,
        label: catalog?.label ?? table,
        domain: catalog?.domain ?? 'other',
        rowCount: rowCounts.get(table) ?? 0,
        columns: columnsByTable.get(table) ?? [],
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      tables,
      edges,
    };
  }

  private async listPublicTables(): Promise<string[]> {
    const rows = await this.dataSource.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );
    return (rows as { table_name: string }[]).map((r) => r.table_name);
  }

  private async listColumns(
    table: string,
  ): Promise<{ column_name: string; data_type: string }[]> {
    return this.dataSource.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [table],
    );
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

function passwordMatchesResetGate(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided, 'utf8').digest();
  const b = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(a, b);
}

function isSensitiveColumn(name: string): boolean {
  return /password|secret|private_?key|encrypted|session_token|api_?key/i.test(
    name,
  );
}

function redactRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (isSensitiveColumn(k)) {
      out[k] = v == null || v === '' ? v : '[REDACTED]';
      continue;
    }
    if (v instanceof Date) {
      out[k] = v.toISOString();
      continue;
    }
    if (Buffer.isBuffer(v)) {
      out[k] = `<bytea ${v.length} bytes>`;
      continue;
    }
    if (typeof v === 'string' && v.length > 4000) {
      out[k] = `${v.slice(0, 4000)}…(+${v.length - 4000})`;
      continue;
    }
    out[k] = v;
  }
  return out;
}

function pickOrderColumn(
  columns: { column_name: string; data_type: string }[],
): string {
  const names = columns.map((c) => c.column_name);
  for (const pref of [
    'created_at',
    'updated_at',
    'id',
    'token_id',
    'ran_at',
    'snapshot_date_kst',
  ]) {
    if (names.includes(pref)) return `"${pref}" DESC NULLS LAST`;
  }
  if (names[0]) return `"${names[0]}" ASC NULLS LAST`;
  return 'ctid ASC';
}

export type { DataInventoryDomainId };
