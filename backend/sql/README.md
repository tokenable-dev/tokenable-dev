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
│   ├── 030_collection_market_snapshots.sql
│   ├── 040_orders.sql
│   ├── 050_refactor_legacy_columns.sql  # migrate older DBs; safe on fresh bootstrap
│   └── 900_triggers.sql          # updated_at triggers
├── scripts/
│   └── bootstrap-db.sh           # cat schema/*.sql — works with stdin pipe / Docker
└── seed-dev-platform-chart-fills.sql
```

## When to use what

| Environment | Approach |
|-------------|----------|
| **Local dev** | `NODE_ENV !== production` → TypeORM `synchronize: true` on backend boot. Easiest path. |
| **Fresh prod / empty DB** | Run bootstrap once, then `TYPEORM_SYNC=false`. |
| **Review / audit** | Read `schema/*.sql` — one file per table group. |

### Bootstrap (recommended)

From repo root, with Docker Postgres:

```bash
chmod +x backend/sql/scripts/bootstrap-db.sh
docker exec -i tokenable-postgres env PGPASSWORD=tokenable \
  backend/sql/scripts/bootstrap-db.sh
```

Or with `DATABASE_URL`:

```bash
DATABASE_URL=postgres://tokenable:tokenable@localhost:5432/tokenable \
  backend/sql/scripts/bootstrap-db.sh
```

When the SQL tree is **on disk inside the container** (volume mount):

```bash
docker exec tokenable-postgres psql -U tokenable -d tokenable \
  -v ON_ERROR_STOP=1 -f /path/to/backend/sql/bootstrap-empty-prod-db.sql
```

(`bootstrap-empty-prod-db.sql` uses `\ir schema/…` — must run from `backend/sql/`.)

## Tables

| Table | Purpose |
|-------|---------|
| `users` | Google OAuth accounts + optional wallet |
| `psa_cert_snapshots` | PSA Public API cache by cert number |
| `marketplace_collections` | Bucket metadata + indexed parallel/cert facets |
| `rwa_tokens` | On-chain mint registry (tokenId → cert, IPFS) |
| `collection_market_snapshots` | Materialized Cardhedger pricing (API read path) |
| `orders` | Seaport ask/bid listings + fulfilled tape |

## Snapshot worker env

| Variable | Purpose |
|----------|---------|
| `MARKET_SNAPSHOT_ON_DEMAND` | Cold-start upstream refresh when no row (default **on**) |
| `MARKET_SNAPSHOT_STALE_AFTER_SEC` | SWR freshness window (default **900**) |
| `MARKET_SNAPSHOT_CRON_ENABLED` | Background `@Cron` refresh (default **on**) |
| `MARKET_SNAPSHOT_REFRESH_CONCURRENCY` | Worker concurrency (default **4**) |
| `MARKET_SNAPSHOT_CRON_MAX_KEYS` | Max keys per cron tick (default **120**) |
| `MARKET_SNAPSHOT_RECENT_FILL_DAYS` | Include collections with recent fulfilled asks (default **30**) |
| `MARKET_SNAPSHOT_VIEWED_LOOKBACK_DAYS` | Include recently viewed collections (default **7**) |
| `MARKET_SNAPSHOT_PREWARM_DELAY_MS` | Boot prewarm delay (default **8000**) |
| `PSA_PUBLIC_SNAPSHOT_DB_TTL_SEC` | PSA cert snapshot cache TTL (default **7 days**) |
| `PSA_PUBLIC_API_REFRESH_ON_SNAPSHOT` | `manual` (default): PSA API only on `cold_start` / `manual` snapshot refresh — not cron/stale_swr/prewarm. `always` / `never` |
| `PSA_PUBLIC_API_MAX_RETRIES` | Extra attempts after HTTP 429 (default **0** — fail fast) |

## Collection bucket key (v2)

`collection_key` = SHA-256 of graded identity including **card number** + **market parallel** (`base` or PSA `Variety` slug). Base and Refractor lines no longer share one bucket.

| Variable | Purpose |
|----------|---------|
| `MARKETPLACE_BUCKET_KEY_MIGRATE_ON_BOOT` | When `1`/`true`, recompute keys for all **active asks** from IPFS metadata and update `orders.collection_key` (run once after deploy) |
| `RWA_TOKEN_REGISTRY_SYNC_ON_BOOT` | When `1`/`true`, scan all minted RWA tokenIds and upsert `rwa_tokens` from chain/IPFS |

After bucket migration, delete stale snapshots for affected keys or wait for `MARKET_SNAPSHOT_SOURCE_VERSION` refresh.

**Schema refactor:** Cardhedger pricing audit columns and per-collection PSA JSON were removed from `marketplace_collections`; use `collection_market_snapshots` and `psa_cert_snapshots` instead. Existing DBs: run `schema/050_refactor_legacy_columns.sql` (included in bootstrap).

---

## Reset PostgreSQL completely (local Docker)

1. `docker compose down`
2. `docker volume rm tokenable-dev_postgres_data` (prefix may differ — `docker volume ls`)
3. `docker compose up -d postgres`
4. `cd backend && pnpm start:dev` — TypeORM sync creates schema, **or** run bootstrap script above first and set `TYPEORM_SYNC=false`.

---

## Dev: platform chart seed data

Fulfilled ask rows for collection chart testing:

```bash
docker exec -i tokenable-postgres psql -U tokenable -d tokenable \
  < backend/sql/seed-dev-platform-chart-fills.sql
```

Match `rwa_contract` / `usdc_contract` at the top of the seed file to `backend/.env`.
