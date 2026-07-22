# Database schema

Canonical model: TypeORM entities under `backend/src/**/entities/*.ts`.

SQL in this folder is the **production DDL mirror** — domain-grouped files for fresh bootstrap (no incremental migration chain).

## Layout

```
sql/
├── bootstrap-empty-prod-db.sql   # psql \ir orchestrator (run from this directory)
├── schema/
│   ├── 010_users_and_auth.sql    # users, wallets, auth providers, KYC, verification tokens
│   ├── 020_vault.sql             # vault_assets, vault_cycles, vault_redemptions
│   ├── 030_rwa_tokens.sql        # on-chain mint registry
│   ├── 040_marketplace.sql       # collections, market snapshots, orders
│   ├── 045_p2p.sql               # P2P listings + payment-escrow orders
│   ├── 050_portfolio.sql         # portfolio snapshots, hidden holdings, watchlist
│   ├── 060_admin.sql             # marketplace_admins
│   ├── 070_cardhedger.sql        # Cardhedger infra + top100 snapshots
│   └── 900_triggers.sql          # updated_at triggers
├── seed/
│   ├── marketplace-admin.sql     # default admin credentials (dev/staging)
│   └── dev-platform-chart-fills.sql
├── maintenance/
│   └── reset_marketplace_data.sql  # wipe marketplace + vault rows (keep users)
└── scripts/
    └── bootstrap-db.sh
```

## When to use what

| Environment | Approach |
|-------------|----------|
| **Local dev** | `NODE_ENV !== production` → TypeORM `synchronize: true` on backend boot |
| **Fresh prod / empty DB** | Run bootstrap once, then `TYPEORM_SYNC=false` |
| **Site relaunch (keep users)** | `maintenance/reset_marketplace_data.sql` |
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

### Reset marketplace data only

Keeps `users`, `marketplace_admins`, and Cardhedger infra tables. Wipes orders, collections, rwa_tokens, vault lifecycle, portfolio snapshots.

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f backend/sql/maintenance/reset_marketplace_data.sql
```

## Tables (21)

| Table | Purpose |
|-------|---------|
| `users` | Platform accounts (Privy / Google / email) |
| `user_wallets` | Linked wallets per user |
| `user_auth_providers` | Normalized login methods |
| `user_kyc_events` | KYC audit trail |
| `verification_tokens` | Email verify + password reset tokens |
| `marketplace_admins` | Admin console credentials |
| `vault_assets` | Permanent physical card identity |
| `vault_cycles` | Deposit→redeem lifecycle per asset |
| `vault_redemptions` | Redemption state machine |
| `rwa_tokens` | On-chain mint registry |
| `marketplace_collections` | Graded-metadata bucket catalog |
| `collection_market_snapshots` | Materialized Cardhedger pricing |
| `orders` | Seaport ask/bid + fulfilled tape |
| `portfolio_daily_snapshots` | Daily 09:00 KST portfolio totals |
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
