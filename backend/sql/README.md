# Database schema

Canonical model: TypeORM entities under `backend/src/**/entities/*.ts`.

SQL in this folder is the **production-grade DDL** mirror — modular, commented, idempotent, with CHECK constraints and partial indexes where they matter.

## Layout

```
sql/
├── bootstrap-empty-prod-db.sql   # psql \ir orchestrator (run from this directory)
├── schema/
│   ├── 010_users.sql
│   ├── 015_psa_cert_snapshots.sql
│   ├── 020_marketplace_collections.sql
│   ├── 025_rwa_tokens.sql
│   ├── 026_rwa_tokens_display_image.sql
│   ├── 030_collection_market_snapshots.sql
│   ├── 040_orders.sql
│   ├── 050_refactor_legacy_columns.sql
│   ├── 060_portfolio_daily_snapshots.sql
│   ├── 061_portfolio_hidden_holdings.sql
│   ├── 062_user_watchlist.sql
│   ├── 063_users_password_hash.sql
│   ├── 064_verification_tokens.sql
│   ├── 065_user_wallets.sql
│   ├── 066_user_wallets_allow_shared.sql
│   ├── 067_password_reset_tokens.sql
│   ├── 068_marketplace_admins.sql
│   ├── 070_cardhedger_price_infra.sql
│   ├── 071_cardhedger_price_delta_import_runs.sql   # apply manually if not in bootstrap
│   ├── 072_cardhedger_delta_catalog_fallback.sql    # apply manually if not in bootstrap
│   └── 900_triggers.sql
├── scripts/
│   └── bootstrap-db.sh
└── seed-dev-platform-chart-fills.sql
```

> **`card_top100_daily_snapshots`** has a TypeORM entity but no SQL file yet — created via `synchronize` in dev. Add schema before bootstrap-only prod deploys that use Top 100.

## When to use what

| Environment | Approach |
|-------------|----------|
| **Local dev** | `NODE_ENV !== production` → TypeORM `synchronize: true` on backend boot |
| **Fresh prod / empty DB** | Run bootstrap once, then apply `071`/`072` if needed, then `TYPEORM_SYNC=false` |
| **Review / audit** | Read `schema/*.sql` — one file per table group |

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

When the SQL tree is **on disk inside the container**:

```bash
docker exec tokenable-postgres psql -U tokenable -d tokenable \
  -v ON_ERROR_STOP=1 -f /path/to/backend/sql/bootstrap-empty-prod-db.sql
```

(`bootstrap-empty-prod-db.sql` uses `\ir schema/…` — must run from `backend/sql/`.)

## Tables (17)

| Table | Purpose |
|-------|---------|
| `users` | Google OAuth + email/password accounts |
| `user_wallets` | Linked wallets (shared address across users allowed) |
| `verification_tokens` | Email verify + password reset tokens |
| `psa_cert_snapshots` | PSA Public API cache by cert number |
| `marketplace_collections` | Bucket metadata + indexed parallel/cert facets |
| `rwa_tokens` | On-chain mint registry (tokenId → cert, IPFS) |
| `collection_market_snapshots` | Materialized Cardhedger pricing (API read path) |
| `orders` | Seaport ask/bid listings + fulfilled tape |
| `portfolio_daily_snapshots` | Daily 09:00 KST portfolio total USD |
| `portfolio_hidden_holdings` | Per-wallet UI hide list |
| `user_watchlist` | Saved collections per user |
| `marketplace_admins` | Marketplace admin console credentials |
| `card_top100_daily_snapshots` | Daily Top 100 rank snapshots (entity/sync) |
| `cardhedger_price_subscriptions` | Cardhedger price push registrations |
| `cardhedger_price_delta_checkpoints` | Delta poll checkpoint (singleton) |
| `cardhedger_daily_price_export_runs` | Nightly CSV export audit |
| `cardhedger_price_delta_import_runs` | Delta import run audit |

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
| `PSA_PUBLIC_SNAPSHOT_DB_TTL_SEC` | PSA cert cache TTL (default **7 days**) |

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

## Dev: platform chart seed data

```bash
docker exec -i tokenable-postgres psql -U tokenable -d tokenable \
  < backend/sql/seed-dev-platform-chart-fills.sql
```

Match contract addresses at the top of the seed file to `backend/.env`.
