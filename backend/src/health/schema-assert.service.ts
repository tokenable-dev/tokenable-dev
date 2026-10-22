import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

export type SchemaRequirement =
  | { kind: 'table'; name: string; fix: string }
  | { kind: 'column'; table: string; column: string; fix: string };

/**
 * Prod schema gates — add a row when code depends on a new table/column
 * that existing DBs get via `backend/sql/maintenance/deploy-sync.sql` (not TypeORM sync).
 */
const DEPLOY_SYNC_FIX = 'maintenance/deploy-sync.sql (or run apply-deploy-maintenance.sh)';

export const REQUIRED_SCHEMA: SchemaRequirement[] = [
  {
    kind: 'table',
    name: 'pricecharting_products',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'column',
    table: 'pricecharting_products',
    column: 'cover_image_url',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'table',
    name: 'pricecharting_catalog_sources',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'table',
    name: 'pricecharting_price_history',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'table',
    name: 'pricecharting_listings',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'table',
    name: 'pricecharting_listing_photos',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'column',
    table: 'vault_cycles',
    column: 'mint_attempt',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'column',
    table: 'rwa_tokens',
    column: 'display_image_back_url',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'column',
    table: 'rwa_tokens',
    column: 'settlement_policy',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'column',
    table: 'rwa_tokens',
    column: 'vault_partner_id',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'column',
    table: 'rwa_tokens',
    column: 'owner_wallet',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'column',
    table: 'rwa_tokens',
    column: 'mint_tx_hash',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'table',
    name: 'rwa_owner_index_cursors',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'table',
    name: 'kbw_mystery_card_burns',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'column',
    table: 'vault_redemptions',
    column: 'payment_batch_id',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'column',
    table: 'vault_redemptions',
    column: 'fee_total_usd',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'column',
    table: 'vault_redemptions',
    column: 'payment_received_usdc_micros',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'column',
    table: 'vault_redemptions',
    column: 'custody_tx_hash',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'column',
    table: 'vault_redemptions',
    column: 'tracking_number',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'column',
    table: 'vault_redemptions',
    column: 'refund_status',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'column',
    table: 'vault_redemptions',
    column: 'admin_memo',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'table',
    name: 'vault_redeem_payment_claims',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'table',
    name: 'marketplace_partner_addresses',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'table',
    name: 'self_vault_settlements',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'column',
    table: 'vault_submission_items',
    column: 'card_number',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'column',
    table: 'marketplace_collections',
    column: 'token_contract',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'column',
    table: 'vault_submissions',
    column: 'token_contract',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'column',
    table: 'portfolio_daily_snapshots',
    column: 'token_contract',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'column',
    table: 'user_buyer_listing_alert',
    column: 'token_contract',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'table',
    name: 'partner_vault_mint_jobs',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'table',
    name: 'partner_vault_mint_job_items',
    fix: DEPLOY_SYNC_FIX,
  },
  {
    kind: 'table',
    name: 'sealed_box_mints',
    fix: DEPLOY_SYNC_FIX,
  },
];

export function formatSchemaAssertFailure(missing: SchemaRequirement[]): string {
  const lines = missing.map((m) => {
    if (m.kind === 'table') {
      return `  - table public.${m.name}  →  backend/sql/${m.fix}`;
    }
    return `  - column ${m.table}.${m.column}  →  backend/sql/${m.fix}`;
  });
  return [
    'Database schema is behind the running API (TYPEORM_SYNC=false).',
    'My Assets / redeem / partner flows will 500 until you apply maintenance SQL:',
    ...lines,
    'Example: docker exec -i tokenable-postgres psql -U tokenable -d tokenable -v ON_ERROR_STOP=1 < backend/sql/<fix>',
  ].join('\n');
}

/**
 * Fail-fast when prod DB is missing columns the entity layer expects.
 * Local/dev: warn only. Production: process.exit(1) unless SCHEMA_ASSERT_ON_BOOT=0.
 */
@Injectable()
export class SchemaAssertService implements OnModuleInit {
  private readonly logger = new Logger(SchemaAssertService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const disabled =
      this.config.get<string>('SCHEMA_ASSERT_ON_BOOT') === '0' ||
      this.config.get<string>('SCHEMA_ASSERT_ON_BOOT') === 'false';
    if (disabled) {
      this.logger.warn('SCHEMA_ASSERT_ON_BOOT disabled — skipping schema check');
      return;
    }

    const missing = await this.findMissing(REQUIRED_SCHEMA);
    if (missing.length === 0) {
      this.logger.log(`Schema assert OK (${REQUIRED_SCHEMA.length} checks)`);
      return;
    }

    const message = formatSchemaAssertFailure(missing);
    const isProd =
      (this.config.get<string>('NODE_ENV') ?? process.env.NODE_ENV) ===
      'production';
    const forceExit =
      this.config.get<string>('SCHEMA_ASSERT_ON_BOOT') === '1' ||
      this.config.get<string>('SCHEMA_ASSERT_ON_BOOT') === 'true';

    if (isProd || forceExit) {
      this.logger.error(message);
      process.exit(1);
    }

    this.logger.warn(message);
  }

  async findMissing(
    requirements: SchemaRequirement[] = REQUIRED_SCHEMA,
  ): Promise<SchemaRequirement[]> {
    const missing: SchemaRequirement[] = [];
    for (const req of requirements) {
      if (req.kind === 'table') {
        const rows = await this.dataSource.query(
          `SELECT 1 AS ok
           FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = $1
           LIMIT 1`,
          [req.name],
        );
        if (!rows?.length) missing.push(req);
        continue;
      }
      const rows = await this.dataSource.query(
        `SELECT 1 AS ok
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1
           AND column_name = $2
         LIMIT 1`,
        [req.table, req.column],
      );
      if (!rows?.length) missing.push(req);
    }
    return missing;
  }
}
