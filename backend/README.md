# Backend (NestJS)

```bash
pnpm install
pnpm start:dev
```

- API: [http://localhost:4000/api](http://localhost:4000/api) · Swagger: [http://localhost:4000/api/docs](http://localhost:4000/api/docs)
- Env: `backend/.env` (Postgres, RPC, Pinata, OAuth, etc.)

**Database:** schema comes from TypeORM entities; no `sql/migrations` folder. See **[sql/README.md](./sql/README.md)** and **[../docs/README.md](../docs/README.md)**.

**Marketplace:** Seaport off-chain order book (`marketplace/orders/*`), collections + **materialized snapshots** (`marketplace/collections/*`, `collection_market_snapshots` table). Matching is **wallet-signed Seaport only**. Overview: **[../docs/api/marketplace.md](../docs/api/marketplace.md)** · DB: **[../docs/architecture/database.md](../docs/architecture/database.md)**.

**Card Hedge:** optional **`CARDHEDGER_API_KEY`**. Public HTTP: **`GET /api/cardhedger/indexes`** (dashboard indexes). All other Cardhedger calls go **server-to-server** via `CardhedgerService.forwardJson` (PSA mint, collection pricing, etc.) — not exposed as `/api/cardhedger/v1/*` HTTP proxies. Override base URL with **`CARDHEDGER_BASE_URL`** if needed.

**PSA spec scraper (clean collection covers):** headless Chromium pulls the **card-only** image (`https://d1htnxwo4o0jhw.cloudfront.net/spec/{specId}/*.jpg`) off Cloudflare-protected PSA spec pages. See **[`docs/api/psa.md` — PSA spec scraper](../docs/api/psa.md#psa-spec-page-scraper-collection-covers)** for failure modes and env vars (`PSA_SPEC_NAV_TIMEOUT_MS`, `PSA_SPEC_SCRAPER_PROXY`, `PSA_SPEC_COVER_ALLOW_FALLBACK`, etc.). Defaults: 120s nav / 45s image wait. Cache: 24h success / 1h failure (override `PSA_SPEC_NEGATIVE_CACHE_MS`).

```bash
# one-time per machine (~100MB) — MUST run from backend/ after cloning or upgrading playwright-core
pnpm run install:browsers
# equivalent: pnpm exec playwright-core install chromium
# Do NOT use `pnpm exec playwright install` unless you add the full `playwright` package.
```

Quick manual check: `pnpm exec ts-node scripts/test-psa-spec-scraper.ts 9656727`.

> **Docker:** the production `Dockerfile` installs browsers under `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright` and runs `playwright-core install --with-deps chromium` with **`CI` unset for that step** so the download is not skipped when `CI=true` elsewhere. Local dev: `pnpm run install:browsers`.
