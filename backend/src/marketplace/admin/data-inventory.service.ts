import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ChainConfigService,
  SUPPORTED_CHAIN_IDS,
  type SupportedChainId,
} from '../../blockchain/chain-config.service';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { createHash, timingSafeEqual } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { CardhedgerDailyPriceExportRun } from '../../cardhedger/entities/cardhedger-daily-price-export-run.entity';
import { CardhedgerPriceDeltaCheckpoint } from '../../cardhedger/entities/cardhedger-price-delta-checkpoint.entity';
import { CardhedgerPriceDeltaImportRun } from '../../cardhedger/entities/cardhedger-price-delta-import-run.entity';
import { CardhedgerPriceSubscription } from '../../cardhedger/entities/cardhedger-price-subscription.entity';
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
    rowCountsEstimated: boolean;
  };
};

/** Planner estimate when > 0; exact COUNT when estimate is 0 (empty vs stale ANALYZE). */
export async function resolveInventoryRowCount(
  estimate: number,
  countExact: () => Promise<number>,
): Promise<number> {
  if (estimate > 0) return Math.floor(estimate);
  return countExact();
}

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
  description: string | null;
  howAccumulated: string | null;
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

export type AdminMarketplaceResetTarget = {
  chainId: SupportedChainId;
  label: string;
  rwaAddress: string;
};

export type AdminMarketplaceResetResult = {
  tokenContract: string;
  chainId: SupportedChainId;
  /** True when tokenContract is the address currently configured for chainId. */
  wipedConfiguredContract: boolean;
  deletedCounts: Record<string, number>;
  skippedMissingTables: string[];
};

const RESET_CHAIN_LABELS: Record<SupportedChainId, string> = {
  1: 'Ethereum',
  137: 'Polygon',
  11155111: 'Sepolia',
};

const ETH_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

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
    private readonly chainConfig: ChainConfigService,
  ) {}

  /** Configured RWA addresses. Each address is its own marketplace. */
  listResetTargets(): AdminMarketplaceResetTarget[] {
    return this.chainConfig.listConfiguredChainIds().map((chainId) => ({
      chainId,
      label: RESET_CHAIN_LABELS[chainId],
      rwaAddress: this.chainConfig.getRwaAddress(chainId),
    }));
  }

  /**
   * Dev/staging only. Deletes rows for one RWA address so that contract's
   * marketplace can be thrown away. Other contracts, users, admins, partners,
   * and Cardhedger audit tables stay.
   *
   * Live reads already key off the configured `CHAIN_{id}_RWA_ADDRESS`, so
   * putting a new address in env starts an empty marketplace. Reset the
   * current address before swapping if this chain's inbox, charts, and
   * unminted vault cycles should go with it.
   */
  async resetForNewContract(
    password: string,
    chainId: number,
    tokenContract: string,
  ): Promise<AdminMarketplaceResetResult> {
    const isProduction =
      this.config.get<boolean>('app.isProduction') ??
      this.config.get<string>('NODE_ENV') === 'production';
    const allowInProduction =
      this.config.get<boolean>(
        'marketplace.adminAllowContractResetInProduction',
      ) === true;
    if (isProduction && !allowInProduction) {
      throw new ForbiddenException(
        'Marketplace reset for new contract is disabled in production (set MARKETPLACE_ADMIN_ALLOW_CONTRACT_RESET_IN_PRODUCTION=true to enable)',
      );
    }

    const expected =
      this.config.get<string>('marketplace.adminDbResetPassword')?.trim() ||
      '';
    if (!expected || !passwordMatchesResetGate(password, expected)) {
      throw new UnauthorizedException('Invalid reset password');
    }

    if (!SUPPORTED_CHAIN_IDS.includes(chainId as SupportedChainId)) {
      throw new BadRequestException(`Unsupported chain id ${chainId}`);
    }
    const chain = chainId as SupportedChainId;
    if (!this.chainConfig.isChainConfigured(chain)) {
      throw new BadRequestException(
        `Chain ${chain} is not configured (set CHAIN_${chain}_RWA_ADDRESS)`,
      );
    }

    const addr = tokenContract.trim().toLowerCase();
    if (!ETH_ADDRESS.test(addr)) {
      throw new BadRequestException('tokenContract must be an Ethereum address');
    }

    const configured = this.chainConfig.getRwaAddress(chain);
    const wipedConfiguredContract = configured === addr;
    const deletedCounts: Record<string, number> = {};
    const skippedMissingTables: string[] = [];

    const has = async (table: string) => {
      const exists = await this.tableExists(table);
      if (!exists) skippedMissingTables.push(table);
      return exists;
    };

    await this.dataSource.transaction(async (manager) => {
      const collectionKeys = await this.collectionKeysForContract(
        manager,
        addr,
        await has('orders'),
        await has('rwa_tokens'),
      );
      const certs = await this.certsForContract(
        manager,
        addr,
        await has('rwa_tokens'),
      );

      const note = async (
        table: string,
        whereSql: string,
        params: unknown[],
        fromSql?: string,
      ) => {
        if (!(await has(table))) return;
        deletedCounts[table] = await this.deleteReturningCount(
          manager,
          table,
          whereSql,
          params,
          fromSql,
        );
      };

      if (wipedConfiguredContract) {
        await note(
          'marketplace_notifications',
          'chain_id = $1',
          [chain],
        );
        if (await has('bulk_mint_jobs')) {
          await note(
            'bulk_mint_job_items',
            `job_id IN (SELECT id FROM bulk_mint_jobs WHERE chain_id = $1)`,
            [chain],
          );
          await note('bulk_mint_jobs', 'chain_id = $1', [chain]);
        } else if (!(await this.tableExists('bulk_mint_job_items'))) {
          skippedMissingTables.push('bulk_mint_job_items');
        }
      }

      await note(
        'portfolio_daily_snapshots',
        `lower(token_contract) = $1
         OR ($2::boolean AND chain_id = $3 AND token_contract IS NULL)`,
        [addr, wipedConfiguredContract, chain],
      );

      await note(
        'self_vault_settlements',
        'lower(token_contract) = $1',
        [addr],
      );
      await note('portfolio_holdings', 'lower(token_contract) = $1', [addr]);
      await note('orders', 'lower(token_contract) = $1', [addr]);

      const hasTokens = await has('rwa_tokens');
      const cycleSql = this.cycleMatchSql(hasTokens);
      const cycleParams: unknown[] = [addr, wipedConfiguredContract, chain];
      if (await has('vault_cycles')) {
        const cycleIds = `(SELECT c.id FROM vault_cycles c WHERE ${cycleSql})`;
        if (await has('vault_redemptions')) {
          await note(
            'vault_redemptions',
            `vault_cycle_id IN ${cycleIds}`,
            cycleParams,
          );
        }
        let emptiedSubmissionIds: string[] = [];
        if (await has('vault_submission_items')) {
          const removed = (await manager.query(
            `DELETE FROM vault_submission_items
             WHERE vault_cycle_id IN ${cycleIds}
             RETURNING submission_id`,
            cycleParams,
          )) as { submission_id: string }[];
          deletedCounts.vault_submission_items = removed.length;
          emptiedSubmissionIds = [
            ...new Set(removed.map((r) => r.submission_id).filter(Boolean)),
          ];
        }
        if (emptiedSubmissionIds.length > 0 && (await has('vault_submissions'))) {
          await note(
            'vault_submissions',
            `id = ANY($1::uuid[])
             AND NOT EXISTS (
               SELECT 1 FROM vault_submission_items i
               WHERE i.submission_id = vault_submissions.id
             )`,
            [emptiedSubmissionIds],
          );
        }
        await note('vault_cycles', cycleSql, cycleParams, 'vault_cycles c');
      }

      if (certs.length > 0) {
        const certVaultDeleted = await this.deleteOpenVaultCyclesForCertNumbers(
          manager,
          chain,
          certs,
          has,
        );
        for (const [table, n] of Object.entries(certVaultDeleted)) {
          deletedCounts[table] = (deletedCounts[table] ?? 0) + n;
        }
      }

      if (await has('vault_submissions')) {
        const stamped = await this.deleteReturningCount(
          manager,
          'vault_submissions',
          `lower(token_contract) = $1
           OR ($2::boolean AND token_contract IS NULL)`,
          [addr, wipedConfiguredContract],
        );
        deletedCounts.vault_submissions =
          (deletedCounts.vault_submissions ?? 0) + stamped;
      }

      if (
        (await has('vault_redeem_payment_claims')) &&
        (await this.tableExists('vault_redemptions'))
      ) {
        await note(
          'vault_redeem_payment_claims',
          `chain_id = $1
           AND NOT EXISTS (
             SELECT 1 FROM vault_redemptions r
             WHERE lower(r.payment_tx_hash) = lower(vault_redeem_payment_claims.payment_tx_hash)
           )`,
          [chain],
        );
      }

      await note(
        'rwa_owner_index_cursors',
        'lower(token_contract) = $1',
        [addr],
      );
      await note('rwa_tokens', 'lower(token_contract) = $1', [addr]);

      if (certs.length > 0 && (await has('vault_assets'))) {
        await note(
          'vault_assets',
          `lower(external_cert_number) = ANY($1::text[])
           AND NOT EXISTS (
             SELECT 1 FROM vault_cycles c WHERE c.vault_asset_id = vault_assets.id
           )`,
          [certs],
        );
      }

      if (
        (await this.tableExists('orders')) &&
        (await this.tableExists('rwa_tokens')) &&
        (await this.tableExists('marketplace_collections'))
      ) {
        const catalogCounts = await this.deleteContractCatalogs(
          manager,
          addr,
          collectionKeys,
        );
        Object.assign(deletedCounts, catalogCounts);
      }
    });

    const result: AdminMarketplaceResetResult = {
      tokenContract: addr,
      chainId: chain,
      wipedConfiguredContract,
      deletedCounts,
      skippedMissingTables: [...new Set(skippedMissingTables)],
    };
    this.logger.warn(
      JSON.stringify({ msg: 'admin_marketplace_reset_for_new_contract', ...result }),
    );
    return result;
  }

  /**
   * Drop catalogs that belong to this address, plus unstamped drafts that have
   * no orders or tokens on any contract (they otherwise show on every admin chain).
   */
  private async deleteContractCatalogs(
    manager: { query: DataSource['query'] },
    addr: string,
    capturedKeys: string[],
  ): Promise<Record<string, number>> {
    const unused = `NOT EXISTS (
         SELECT 1 FROM orders o
         WHERE lower(o.collection_key) = lower(c.collection_key)
       )
       AND NOT EXISTS (
         SELECT 1 FROM rwa_tokens t
         WHERE lower(t.collection_key) = lower(c.collection_key)
       )`;
    const owned = `(
      lower(c.token_contract) = $1
      OR c.token_contract IS NULL
      OR ($2::text[] <> ARRAY[]::text[] AND lower(c.collection_key) = ANY($2::text[]))
    )`;
    const counts: Record<string, number> = {};
    const dropChild = async (table: string, alias: string) => {
      if (!(await this.tableExists(table))) return;
      counts[table] = await this.deleteReturningCount(
        manager,
        table,
        `lower(${alias}.collection_key) IN (
           SELECT lower(c.collection_key) FROM marketplace_collections c
           WHERE ${unused} AND ${owned}
         )`,
        [addr, capturedKeys],
      );
    };
    await dropChild('user_watchlist', 'user_watchlist');
    await dropChild('user_buyer_listing_alert', 'user_buyer_listing_alert');
    await dropChild('cardhedger_price_subscriptions', 'cardhedger_price_subscriptions');
    await dropChild('collection_market_snapshots', 'collection_market_snapshots');
    counts.marketplace_collections = await this.deleteReturningCount(
      manager,
      'marketplace_collections',
      `${unused.replaceAll('c.collection_key', 'marketplace_collections.collection_key')}
       AND (
         lower(marketplace_collections.token_contract) = $1
         OR marketplace_collections.token_contract IS NULL
         OR ($2::text[] <> ARRAY[]::text[] AND lower(marketplace_collections.collection_key) = ANY($2::text[]))
       )`,
      [addr, capturedKeys],
    );
    return counts;
  }

  /**
   * Cycles minted on this contract, plus — only when wiping the address
   * currently configured for the chain — unminted cycles on that chain that
   * are not tied to a different contract.
   */
  private cycleMatchSql(hasRwaTokens: boolean): string {
    const linked = hasRwaTokens
      ? `c.id IN (
          SELECT vault_cycle_id FROM rwa_tokens
          WHERE lower(token_contract) = $1 AND vault_cycle_id IS NOT NULL
        )`
      : 'FALSE';
    const unminted = hasRwaTokens
      ? `$2::boolean
         AND c.chain_id = $3
         AND NOT EXISTS (
           SELECT 1 FROM rwa_tokens t
           WHERE t.vault_cycle_id = c.id
             AND lower(t.token_contract) <> $1
         )`
      : '$2::boolean AND c.chain_id = $3';
    return `(${linked}) OR (${unminted})`;
  }

  private async collectionKeysForContract(
    manager: { query: DataSource['query'] },
    addr: string,
    hasOrders: boolean,
    hasTokens: boolean,
  ): Promise<string[]> {
    const parts: string[] = [];
    if (hasOrders) {
      parts.push(
        `SELECT lower(collection_key) AS k FROM orders
         WHERE lower(token_contract) = $1 AND collection_key IS NOT NULL`,
      );
    }
    if (hasTokens) {
      parts.push(
        `SELECT lower(collection_key) AS k FROM rwa_tokens
         WHERE lower(token_contract) = $1 AND collection_key IS NOT NULL`,
      );
    }
    if (parts.length === 0) return [];
    const rows = (await manager.query(
      parts.join(' UNION '),
      [addr],
    )) as { k: string }[];
    return [...new Set(rows.map((r) => String(r.k).toLowerCase()).filter(Boolean))];
  }

  /**
   * Cert-scoped vault cleanup so remint works after contract wipe even when
   * rwa_tokens were deleted manually and left orphan open cycles on the chain.
   */
  private async deleteOpenVaultCyclesForCertNumbers(
    manager: { query: DataSource['query'] },
    chainId: number,
    certNumbers: string[],
    has: (table: string) => Promise<boolean>,
  ): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    if (certNumbers.length === 0 || !(await has('vault_cycles'))) {
      return counts;
    }
    const cycleIdsSql = `(
      SELECT c.id FROM vault_cycles c
      INNER JOIN vault_assets a ON a.id = c.vault_asset_id
      WHERE c.chain_id = $1
        AND lower(a.external_cert_number) = ANY($2::text[])
        AND c.status NOT IN ('redeemed', 'cancelled')
    )`;
    const params = [chainId, certNumbers];

    if (await has('vault_redemptions')) {
      counts.vault_redemptions = await this.deleteReturningCount(
        manager,
        'vault_redemptions',
        `vault_cycle_id IN ${cycleIdsSql}`,
        params,
      );
    }
    if (await has('vault_submission_items')) {
      counts.vault_submission_items = await this.deleteReturningCount(
        manager,
        'vault_submission_items',
        `vault_cycle_id IN ${cycleIdsSql}`,
        params,
      );
    }
    counts.vault_cycles = await this.deleteReturningCount(
      manager,
      'vault_cycles',
      `id IN ${cycleIdsSql}`,
      params,
      'vault_cycles',
    );
    return counts;
  }

  private async certsForContract(
    manager: { query: DataSource['query'] },
    addr: string,
    hasTokens: boolean,
  ): Promise<string[]> {
    if (!hasTokens) return [];
    const rows = (await manager.query(
      `SELECT DISTINCT lower(cert_number) AS c FROM rwa_tokens
       WHERE lower(token_contract) = $1 AND cert_number IS NOT NULL`,
      [addr],
    )) as { c: string }[];
    return rows.map((r) => String(r.c).toLowerCase()).filter(Boolean);
  }

  private async deleteReturningCount(
    manager: { query: DataSource['query'] },
    table: string,
    whereSql: string,
    params: unknown[],
    fromSql?: string,
  ): Promise<number> {
    const from = fromSql ?? `"${table}"`;
    const rows = await manager.query(
      `WITH deleted AS (
         DELETE FROM ${from} WHERE ${whereSql} RETURNING 1
       )
       SELECT COUNT(*)::int AS n FROM deleted`,
      params,
    );
    return Number(rows?.[0]?.n ?? 0);
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

  private async estimateRows(table: string): Promise<number> {
    const rows = await this.dataSource.query(
      `SELECT GREATEST(c.reltuples, 0)::bigint AS n
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind = 'r'`,
      [table],
    );
    return Number(rows?.[0]?.n ?? 0);
  }

  private async estimateAllRows(): Promise<Map<string, number>> {
    const rows = (await this.dataSource.query(
      `SELECT c.relname AS table_name, GREATEST(c.reltuples, 0)::bigint AS n
       FROM pg_class c
       JOIN pg_namespace ns ON ns.oid = c.relnamespace
       WHERE ns.nspname = 'public' AND c.relkind = 'r'`,
    )) as { table_name: string; n: string | number }[];
    return new Map(rows.map((r) => [r.table_name, Number(r.n ?? 0)]));
  }

  /**
   * Paginated raw rows for any public table (admin browse).
   * Table name must be snake_case and exist in `public`.
   */
  async getTableRows(
    table: string,
    page: number,
    pageSize: number,
    compact = false,
  ): Promise<AdminDataInventoryRowsResult> {
    const safe = table.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]*$/.test(safe)) {
      throw new BadRequestException('Invalid table name');
    }
    if (!(await this.tableExists(safe))) {
      throw new NotFoundException(`Table not found: ${safe}`);
    }

    const limit = compact ? Math.min(pageSize, 8) : pageSize;
    const total = compact
      ? await this.estimateRows(safe)
      : await this.countRows(safe);
    const columns = await this.listColumns(safe);
    const orderCol = pickOrderColumn(columns);
    const offset = (page - 1) * limit;
    const rawRows: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT * FROM "${safe}" ORDER BY ${orderCol} LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    const rows = rawRows.map((row) =>
      compact ? compactRow(redactRow(row)) : redactRow(row),
    );
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
      pageSize: limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      rows,
    };
  }

  async getInventory(): Promise<DataInventoryResponse> {
    const estimates = await this.estimateAllRows();
    const statsById = await this.loadAllStats(estimates);
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
        const rowCount = await resolveInventoryRowCount(
          estimates.get(table) ?? 0,
          () => this.countRows(table),
        );
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
        rowCountsEstimated: true,
      },
    };
  }

  async getSchema(): Promise<DataInventorySchemaResponse> {
    const publicTables = await this.listPublicTables();
    const tableSet = new Set(publicTables);
    const catalogByTable = new Map(DATA_STORE_CATALOG.map((s) => [s.table, s]));
    const rowCounts = await this.estimateAllRows();

    const allCols = (await this.dataSource.query(
      `SELECT table_name, column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public'
       ORDER BY table_name, ordinal_position`,
    )) as { table_name: string; column_name: string; data_type: string }[];

    const columnsByTable = new Map<string, DataInventorySchemaColumn[]>();
    for (const table of publicTables) {
      columnsByTable.set(table, []);
    }
    for (const c of allCols) {
      const list = columnsByTable.get(c.table_name);
      if (!list) continue;
      list.push({
        name: c.column_name,
        dataType: c.data_type,
        primaryKey: false,
        unique: false,
        foreignKey: false,
      });
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
        description: catalog?.description ?? null,
        howAccumulated: catalog?.howAccumulated ?? null,
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

  private async loadAllStats(
    estimates: Map<string, number>,
  ): Promise<Map<string, DataStoreStats>> {
    const results = await Promise.all([
      this.loadSimple('marketplace_collections', this.collectionsRepo, {
        oldest: 'createdAt',
        newest: 'createdAt',
        lastActivity: 'createdAt',
      }, estimates),
      this.loadSimple('rwa_tokens', this.rwaRepo, {
        oldest: 'createdAt',
        newest: 'createdAt',
        lastActivity: 'createdAt',
      }, estimates),
      this.loadSimple('bulk_mint_jobs', this.bulkMintJobsRepo, {
        oldest: 'createdAt',
        newest: 'updatedAt',
        lastActivity: 'updatedAt',
      }, estimates),
      this.loadSimple('bulk_mint_job_items', this.bulkMintItemsRepo, {
        oldest: 'createdAt',
        newest: 'updatedAt',
        lastActivity: 'updatedAt',
      }, estimates),
      this.loadSimple('marketplace_partners', this.partnersRepo, {
        oldest: 'createdAt',
        newest: 'updatedAt',
        lastActivity: 'updatedAt',
      }, estimates),
      this.loadMarketSnapshots(estimates),
      this.loadSimple('cardhedger_price_delta_import_runs', this.deltaRunsRepo, {
        oldest: 'ranAt',
        newest: 'ranAt',
        lastActivity: 'ranAt',
      }, estimates),
      this.loadDeltaCheckpoint(),
      this.loadPriceSubscriptions(estimates),
      this.loadSimple('cardhedger_daily_price_export_runs', this.exportRunsRepo, {
        oldest: 'ranAt',
        newest: 'ranAt',
        lastActivity: 'ranAt',
      }, estimates),
      this.loadPortfolioSnapshots(estimates),
      this.loadSimple('portfolio_holdings', this.portfolioHoldingsRepo, {
        oldest: 'createdAt',
        newest: 'updatedAt',
        lastActivity: 'updatedAt',
      }, estimates),
      this.loadSimple('user_watchlist', this.watchlistRepo, {
        oldest: 'createdAt',
        newest: 'createdAt',
        lastActivity: 'createdAt',
      }, estimates),
      this.loadSimple('orders', this.ordersRepo, {
        oldest: 'createdAt',
        newest: 'updatedAt',
        lastActivity: 'updatedAt',
      }, estimates),
      this.loadSimple('users', this.usersRepo, {
        oldest: 'createdAt',
        newest: 'createdAt',
        lastActivity: 'createdAt',
      }, estimates),
      this.loadSimple('user_wallets', this.walletsRepo, {
        oldest: 'linkedAt',
        newest: 'updatedAt',
        lastActivity: 'updatedAt',
      }, estimates),
      this.loadSimple('user_kyc_events', this.kycEventsRepo, {
        oldest: 'createdAt',
        newest: 'createdAt',
        lastActivity: 'createdAt',
      }, estimates),
      this.loadSimple('vault_assets', this.vaultAssetsRepo, {
        oldest: 'createdAt',
        newest: 'updatedAt',
        lastActivity: 'updatedAt',
      }, estimates),
      this.loadSimple('vault_cycles', this.vaultCyclesRepo, {
        oldest: 'createdAt',
        newest: 'updatedAt',
        lastActivity: 'updatedAt',
      }, estimates),
      this.loadSimple('vault_redemptions', this.vaultRedemptionsRepo, {
        oldest: 'createdAt',
        newest: 'createdAt',
        lastActivity: 'createdAt',
      }, estimates),
      this.loadSimple('vault_submissions', this.vaultSubmissionsRepo, {
        oldest: 'createdAt',
        newest: 'updatedAt',
        lastActivity: 'updatedAt',
      }, estimates),
      this.loadSimple('vault_submission_items', this.vaultSubmissionItemsRepo, {
        oldest: 'createdAt',
        newest: 'updatedAt',
        lastActivity: 'updatedAt',
      }, estimates),
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
    estimates: Map<string, number>,
  ): Promise<[string, DataStoreStats]> {
    try {
      const rowCount = await resolveInventoryRowCount(
        estimates.get(id) ?? 0,
        () => this.countRows(id),
      );
      if (rowCount === 0) return [id, emptyStats()];

      const alias = 'row';
      const oldestCol = `${alias}.${columns.oldest}`;
      const newestCol = `${alias}.${columns.newest}`;
      const lastCol = `${alias}.${columns.lastActivity}`;

      const row = await repo
        .createQueryBuilder(alias)
        .select(`MIN(${oldestCol})`, 'oldestAt')
        .addSelect(`MAX(${newestCol})`, 'newestAt')
        .addSelect(`MAX(${lastCol})`, 'lastActivityAt')
        .getRawOne<{
          oldestAt: Date | string | null;
          newestAt: Date | string | null;
          lastActivityAt: Date | string | null;
        }>();

      return [
        id,
        this.toStats({
          rowCount,
          oldestAt: row?.oldestAt ?? null,
          newestAt: row?.newestAt ?? null,
          lastActivityAt: row?.lastActivityAt ?? null,
        }),
      ];
    } catch (err) {
      this.logSkip(id, err);
      return [id, emptyStats()];
    }
  }

  private async loadMarketSnapshots(
    estimates: Map<string, number>,
  ): Promise<[string, DataStoreStats]> {
    const id = 'collection_market_snapshots';
    try {
      const [aggregate, stateRows, withCardhedger] = await Promise.all([
        this.marketSnapshotsRepo
          .createQueryBuilder('s')
          .select('MIN(s.createdAt)', 'oldestAt')
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

      const rowCount = await resolveInventoryRowCount(
        estimates.get(id) ?? 0,
        () => this.countRows(id),
      );
      return [
        id,
        {
          ...this.toStats({
            ...(aggregate ?? emptyTableStats()),
            rowCount,
          }),
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


  private async loadPortfolioSnapshots(
    estimates: Map<string, number>,
  ): Promise<[string, DataStoreStats]> {
    const id = 'portfolio_daily_snapshots';
    try {
      const [aggregate, wallets] = await Promise.all([
        this.portfolioSnapshotsRepo
          .createQueryBuilder('p')
          .select('MIN(p.snapshotDateKst)', 'oldestAt')
          .addSelect('MAX(p.snapshotDateKst)', 'newestAt')
          .addSelect('MAX(p.createdAt)', 'lastActivityAt')
          .getRawOne<TableStats>(),
        this.portfolioSnapshotsRepo
          .createQueryBuilder('p')
          .select('COUNT(DISTINCT p.walletAddress)::int', 'count')
          .getRawOne<{ count: number }>(),
      ]);

      const rowCount = await resolveInventoryRowCount(
        estimates.get(id) ?? 0,
        () => this.countRows(id),
      );
      return [
        id,
        {
          rowCount,
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

  private async loadPriceSubscriptions(
    estimates: Map<string, number>,
  ): Promise<[string, DataStoreStats]> {
    const id = 'cardhedger_price_subscriptions';
    try {
      const [aggregate, active] = await Promise.all([
        this.priceSubscriptionsRepo
          .createQueryBuilder('s')
          .select('MIN(s.subscribedAt)', 'oldestAt')
          .addSelect(
            'MAX(COALESCE(s.lastWebhookAt, s.subscribedAt))',
            'lastActivityAt',
          )
          .getRawOne<TableStats>(),
        this.priceSubscriptionsRepo.count({ where: { active: true } }),
      ]);

      const lastActivityAt = this.isoTimestamp(aggregate?.lastActivityAt);
      const rowCount = await resolveInventoryRowCount(
        estimates.get(id) ?? 0,
        () => this.countRows(id),
      );
      return [
        id,
        {
          rowCount,
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

function compactRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v != null && typeof v === 'object') {
      const s = JSON.stringify(v);
      out[k] =
        s && s.length > 180 ? `${s.slice(0, 180)}…(+${s.length - 180})` : s;
      continue;
    }
    if (typeof v === 'string' && v.length > 180) {
      out[k] = `${v.slice(0, 180)}…(+${v.length - 180})`;
      continue;
    }
    out[k] = v;
  }
  return out;
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
