# Database schema

Canonical model: TypeORM entities under `backend/src/**/entities/*.ts`.

SQL in this folder is the **production-grade DDL** mirror — modular, commented, idempotent, with CHECK constraints and partial indexes where they matter.

## Layout

```
sql/
├── bootstrap-empty-prod-db.sql   # psql \ir orchestrator (run from this directory)
├── schema/
│   ├── 010_users.sql
│   ├── 020_marketplace_collections.sql
│   ├── 030_collection_market_snapshots.sql
│   ├── 040_orders.sql
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
| `marketplace_collections` | Bucket metadata, cover, PSA/Cardhedger enrichments |
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
