# Database schema

Canonical model: TypeORM entities under `backend/src/**/entities/*.ts`.

SQL in this folder is the **production DDL mirror** — domain-grouped files for fresh bootstrap (no incremental migration chain).

## Layout

```
sql/
├── bootstrap-empty-prod-db.sql   # psql \ir orchestrator (run from this directory)
├── schema/
│   ├── 010_users_and_auth.sql    # users, wallets, auth providers, KYC, verification tokens
│   ├── 020_vault.sql             # vault_assets/cycles/redemptions + sell-flow submissions
│   ├── 030_rwa_tokens.sql        # on-chain mint registry
│   ├── 040_marketplace.sql       # collections, market snapshots, orders
│   ├── 045_p2p.sql               # P2P listings + payment-escrow orders
│   ├── 050_portfolio.sql         # portfolio snapshots, hidden holdings, watchlist
│   ├── 060_admin.sql             # marketplace_admins
│   ├── 064_marketplace_partners.sql  # consignment partners (encrypted keys)
│   ├── 066_marketplace_partner_addresses.sql  # partner Origin (FedEx ship-from)
│   ├── 065_bulk_mint.sql         # partner bulk mint+list jobs
│   ├── 070_cardhedger.sql        # Cardhedger infra + top100 snapshots
│   └── 900_triggers.sql          # updated_at triggers
├── seed/
│   ├── marketplace-admin.sql     # default admin credentials (dev/staging)
│   └── dev-platform-chart-fills.sql
├── maintenance/
│   ├── reset_marketplace_data.sql       # wipe marketplace + vault rows (keep users)
│   ├── add_vault_submissions.sql        # existing DBs: sell-flow submission tables
│   ├── add_marketplace_partners.sql     # existing DBs: partners table
│   ├── add_marketplace_partner_addresses.sql  # existing DBs: partner Origin address
│   ├── add_bulk_mint_tables.sql         # existing DBs: bulk mint tables
│   ├── migrate_bulk_mint_to_partner_list.sql  # upgrade old custody bulk mint
│   ├── add_collection_review_status.sql
│   ├── add_portfolio_daily_snapshot_chain_id.sql
│   ├── add_vault_cycles_chain_id.sql
│   ├── add_marketplace_notifications_chain_id.sql
│   ├── cancel_legacy_vault_submission_drafts.sql  # cancel orphan status=draft packages
│   ├── add_self_vault_settlements.sql
│   ├── add_rwa_tokens_settlement_policy.sql
│   ├── alter_marketplace_partners_optional_pk.sql
│   ├── add_rwa_tokens_vault_partner_id.sql
   │   ├── add_user_settings_prefs_and_addresses.sql
   │   ├── add_vault_redemptions_custody_refund.sql  # redeem payment micros, custody, refunds, memo, tracking
   │   ├── add_vault_redeem_payment_claims.sql      # UNIQUE payment_tx_hash → one batch
   │   ├── harden_vault_redemptions_integrity.sql # refund CHECK, payment FK, comments
   │   └── ensure_marketplace_chain_indexes.sql
└── scripts/
    └── bootstrap-db.sh
```

## When to use what

| Environment | Approach |
|-------------|----------|
| **Local dev** | `NODE_ENV !== production` → TypeORM `synchronize: true` on backend boot |
| **Fresh prod / empty DB** | Run bootstrap once, then `TYPEORM_SYNC=false` |
| **Site relaunch (keep users)** | `maintenance/reset_marketplace_data.sql` — run `node scripts/burn-all-rwa-tokens.mjs` first if re-minting same PSA certs |
| **Review / audit** | Read `schema/*.sql` — one file per domain |

### Bootstrap (recommended)

From repo root, with Docker Postgres:

```bash
chmod +x backend/sql/scripts/bootstrap-db.sh
docker exec -i tokenable-postgres env PGPASSWORD=tokenable \
  bash -s < backend/sql/scripts/bootstrap-db.sh
```

Or with `DATABASE_URL`:

```bash
DATABASE_URL=postgres://tokenable:tokenable@localhost:5432/tokenable \
  backend/sql/scripts/bootstrap-db.sh
```

(`bootstrap-empty-prod-db.sql` uses `\ir schema/…` — must run from `backend/sql/`.)

### Existing DB: portfolio chain_id + marketplace indexes

If `portfolio_daily_snapshots` still has UNIQUE `(wallet_address, snapshot_date_kst)` (no `chain_id`), apply:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f backend/sql/maintenance/add_portfolio_daily_snapshot_chain_id.sql
```

Optional (safe to re-run) — restores/adds order + P2P indexes used by chain-scoped reads:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f backend/sql/maintenance/ensure_marketplace_chain_indexes.sql
```

**Do not rely on TypeORM `synchronize` for the portfolio unique-key change** — the old unique constraint must be dropped explicitly.

### Existing DB: marketplace notifications chain_id

If `marketplace_notifications` has no `chain_id` (inbox mixed Sepolia + Polygon alerts), apply:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f backend/sql/maintenance/add_marketplace_notifications_chain_id.sql
```

Legacy rows backfill as Sepolia (`11155111`). New bid alerts store the RWA contract’s chain.

### Existing DB: vault cycles chain_id

If `vault_cycles` has no `chain_id` (open-cycle rule was global across chains — a Sepolia mint blocked the same cert on Polygon), apply:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f backend/sql/maintenance/add_vault_cycles_chain_id.sql
```

Backfills legacy cycles (P2P-linked rows from `p2p_listings.chain_id`, the rest as Sepolia) and replaces the partial unique index `uq_vault_cycles_one_open_per_asset` with `(vault_asset_id, chain_id)`. **`synchronize` alone will not replace the partial index.**

### Reset marketplace data only

Keeps `users`, `marketplace_admins`, and Cardhedger infra tables. Wipes orders, collections, rwa_tokens, vault lifecycle, portfolio snapshots.

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f backend/sql/maintenance/reset_marketplace_data.sql
```

## Tables (24)

| Table | Purpose |
|-------|---------|
| `users` | Platform accounts (Privy / Google / email) |
| `user_wallets` | Linked wallets per user |
| `user_auth_providers` | Normalized login methods |
| `user_kyc_events` | KYC audit trail |
| `verification_tokens` | Email verify + password reset tokens |
| `marketplace_admins` | Admin console credentials |
| `marketplace_partners` | Consignment sellers (encrypted wallet keys) |
| `bulk_mint_jobs` | Partner mint+list job runs |
| `bulk_mint_job_items` | Per-cert rows (price, order_hash, status) |
| `vault_assets` | Permanent physical card identity |
| `vault_cycles` | Deposit→redeem lifecycle per asset |
| `vault_redemptions` | Redemption state machine |
| `rwa_tokens` | On-chain mint registry |
| `marketplace_collections` | Graded-metadata bucket catalog |
| `collection_market_snapshots` | Materialized Cardhedger pricing |
| `orders` | Seaport ask/bid + fulfilled tape |
| `portfolio_daily_snapshots` | Daily 09:00 KST portfolio totals **per chain** (`chain_id`) |
| `portfolio_holdings` | Per-wallet hide + cost basis |
| `user_watchlist` | Saved collections per user |
| `cardhedger_price_subscriptions` | Cardhedger price push registrations |
| `cardhedger_price_delta_checkpoints` | Delta poll checkpoint (singleton) |
| `cardhedger_daily_price_export_runs` | Nightly CSV export audit |
| `cardhedger_price_delta_import_runs` | Delta import run audit |
| `card_top100_daily_snapshots` | Daily Top 100 rank snapshots |

Full ER diagram: **[../docs/architecture/database.md](../docs/architecture/database.md)**

## Portfolio daily snapshot env

| Variable | Purpose |
|----------|---------|
| `PORTFOLIO_SNAPSHOT_CRON_ENABLED` | Daily 09:00 KST capture (default **on** in `production`) |
| `PORTFOLIO_SNAPSHOT_BOOTSTRAP_ENABLED` | Boot capture into active slot (default **on** in `production`) |
| `PORTFOLIO_SNAPSHOT_BOOTSTRAP_DELAY_MS` | Delay before bootstrap (default **10000**) |
| `PORTFOLIO_SNAPSHOT_OWNER_SCAN_CONCURRENCY` | Parallel `ownerOf` RPC (default **24**) |
| `PORTFOLIO_SNAPSHOT_CAPTURE_CONCURRENCY` | Parallel wallet upserts (default **8**) |

## Snapshot worker env

| Variable | Purpose |
|----------|---------|
| `MARKET_SNAPSHOT_ON_DEMAND` | Cold-start upstream refresh (default **on**) |
| `MARKET_SNAPSHOT_STALE_AFTER_SEC` | SWR freshness window (default **900**) |
| `MARKET_SNAPSHOT_CRON_ENABLED` | Background refresh (default **on**) |
| `MARKET_SNAPSHOT_REFRESH_CONCURRENCY` | Worker concurrency (default **4**) |
| `MARKET_SNAPSHOT_CRON_MAX_KEYS` | Max keys per cron tick (default **120**) |
| `PSA_PUBLIC_API_REFRESH_ON_SNAPSHOT` | When `always`, snapshot refresh may call PSA for cert mirror |

## Collection bucket key (v2)

| Variable | Purpose |
|----------|---------|
| `MARKETPLACE_BUCKET_KEY_MIGRATE_ON_BOOT` | Recompute active ask keys from IPFS metadata |
| `RWA_TOKEN_REGISTRY_SYNC_ON_BOOT` | Scan all minted tokenIds → `rwa_tokens` |

---

## Reset PostgreSQL completely (local Docker)

1. `docker compose down`
2. `docker volume rm tokenable-dev_postgres_data` (prefix may differ — `docker volume ls`)
3. `docker compose up -d postgres`
4. `cd backend && pnpm start:dev` — TypeORM sync, **or** run bootstrap + `TYPEORM_SYNC=false`

---

## Dev seeds (optional)

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/sql/seed/marketplace-admin.sql
psql "$DATABASE_URL" -f backend/sql/seed/dev-platform-chart-fills.sql
```

Match contract addresses at the top of `dev-platform-chart-fills.sql` to `backend/.env`.
