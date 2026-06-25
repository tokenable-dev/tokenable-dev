# Backend (NestJS)

```bash
pnpm install
pnpm start:dev
```

- API: [http://localhost:4100/api](http://localhost:4100/api) (local dev default — see [local-setup.md](../docs/guides/local-setup.md))
- Swagger: [http://localhost:4100/api/docs](http://localhost:4100/api/docs)
- Env: `backend/.env` (Postgres, **Redis** `REDIS_URL`, RPC, Pinata, OAuth, Cardhedger, PSA, …)
- Infra: `docker compose up -d postgres redis` (Redis = identity cache L2 on host port **6380**)

**Database:** 17 TypeORM entities; production DDL in **`sql/schema/`**. See **[sql/README.md](./sql/README.md)** and **[../docs/architecture/database.md](../docs/architecture/database.md)**.

**Marketplace:** Seaport off-chain order book, collections + **materialized snapshots**, portfolio daily cron, **user watchlist**. Overview: **[../docs/api/marketplace.md](../docs/api/marketplace.md)**.

**Cardhedger:**
- **`/api/cardhedger/v1/*`** — full upstream proxy (API key injected server-side)
- **Top 100 / Top Movers** — `/api/cardhedger/top100/*`, `/api/cardhedger/top-movers`
- **Price webhooks** — `POST /api/webhooks/cardhedger/price-updates`
- **Admin ops** — `/api/admin/cardhedger/*`, `/api/admin/cardhedger/price-subscriptions/*`
- Internal server-to-server calls from PSA, collections, snapshot workers

**Card Ladder indexes:** **`GET /api/cardladder/indexes`** — landing dashboard (Playwright + cache).

**Auth:** Google OAuth + email/password + wallet link (signature challenge). See **[../docs/api/auth.md](../docs/api/auth.md)**.

**Site access:** optional staging gate — **`SITE_ACCESS_ENABLED`**. See **[../docs/api/site-access.md](../docs/api/site-access.md)**.

**Collection covers:** **`CollectionCoverService`** sets display images from Cardhedger catalog URLs and Pokémon TCG HTTPS art at first listing.

> **Docker:** the production `Dockerfile` installs Playwright browsers under `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright`. Local dev: `pnpm run install:browsers`.

**Vault module:** not implemented — inbound custody/mint orchestration is planned separately.
