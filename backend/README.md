# Backend (NestJS)

```bash
pnpm install
pnpm start:dev
```

- API: [http://localhost:4000/api](http://localhost:4000/api) · Swagger: [http://localhost:4000/api/docs](http://localhost:4000/api/docs)
- Env: `backend/.env` (Postgres, **Redis** `REDIS_URL`, RPC, Pinata, OAuth, etc.)
- Infra: `docker compose up -d postgres redis` (Redis = identity cache L2)

**Database:** schema comes from TypeORM entities; no `sql/migrations` folder. See **[sql/README.md](./sql/README.md)** and **[../docs/README.md](../docs/README.md)**.

**Marketplace:** Seaport off-chain order book (`marketplace/orders/*`), collections + **materialized snapshots** (`marketplace/collections/*`, `collection_market_snapshots` table). Matching is **wallet-signed Seaport only**. Overview: **[../docs/api/marketplace.md](../docs/api/marketplace.md)** · DB: **[../docs/architecture/database.md](../docs/architecture/database.md)**.

**Card Hedge:** optional **`CARDHEDGER_API_KEY`**. All Cardhedger calls go **server-to-server** via `CardhedgerService.forwardJson` (PSA mint, collection pricing, collection covers, etc.) — not exposed as `/api/cardhedger/v1/*` HTTP proxies. Override base URL with **`CARDHEDGER_BASE_URL`** if needed.

**Card Ladder indexes:** public **`GET /api/cardladder/indexes`** — landing dashboard indexes (Pokemon/MLB/NFL/NBA) scraped from Card Ladder with Playwright + cache.

**Collection covers:** **`CollectionCoverService`** sets display images once from **Cardhedger** catalog URLs and **Pokémon TCG** HTTPS art (at first listing). See **[`docs/api/psa.md` — collection covers](../docs/api/psa.md#collection-covers)**.

> **Docker:** the production `Dockerfile` installs browsers under `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright` and runs `playwright-core install --with-deps chromium` with **`CI` unset for that step** so the download is not skipped when `CI=true` elsewhere. Local dev: `pnpm run install:browsers`.
