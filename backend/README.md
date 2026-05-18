# Backend (NestJS)

```bash
pnpm install
pnpm start:dev
```

- API: [http://localhost:4000/api](http://localhost:4000/api) · Swagger: [http://localhost:4000/api/docs](http://localhost:4000/api/docs)
- Env: `backend/.env` (Postgres, RPC, Pinata, OAuth, etc.)

**Database:** schema comes from TypeORM entities; no `sql/migrations` folder. See **[sql/README.md](./sql/README.md)** and **[../docs/README.md](../docs/README.md)**.

**Marketplace:** Seaport off-chain order book (`marketplace/orders/*`), collections & Cardhedger bundle routes (`marketplace/collections/*`), portfolio hidden assets (`marketplace/assets/*`). Matching is **wallet-signed Seaport only** (no separate relational trading API). Overview: **[../docs/api/marketplace.md](../docs/api/marketplace.md)** · Docs index: **[../docs/README.md](../docs/README.md)**.

**Card Hedge:** optional **`CARDHEDGER_API_KEY`**. Public HTTP: **`GET /api/cardhedger/indexes`** (dashboard indexes). All other Cardhedger calls go **server-to-server** via `CardhedgerService.forwardJson` (PSA mint, collection pricing, etc.) — not exposed as `/api/cardhedger/v1/*` HTTP proxies. Override base URL with **`CARDHEDGER_BASE_URL`** if needed.

**PSA spec scraper (clean collection covers):** headless Chromium pulls the **card-only** image (`https://d1htnxwo4o0jhw.cloudfront.net/spec/{specId}/*.jpg`) off Cloudflare-protected `psacard.com/spec/psa/{specId}` pages. When metadata includes a PSA **`specId`**, that path **only** uses this scraper (no `.env` flags; fixed 45s / 30s timeouts in code). If there is no `specId`, covers fall back to Cardhedger / Pokemon TCG as before. Results are cached per `specId` (24h positive / 1h negative) and persisted via the normal cover pipeline.

```bash
# one-time per machine (~100MB) — MUST run from backend/ after cloning or upgrading playwright-core
pnpm run install:browsers
# equivalent: pnpm exec playwright-core install chromium
# Do NOT use `pnpm exec playwright install` unless you add the full `playwright` package.
```

Quick manual check: `pnpm exec ts-node scripts/test-psa-spec-scraper.ts 9656727`.

> **Docker:** the production `Dockerfile` installs browsers under `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright` and runs `playwright-core install --with-deps chromium` with **`CI` unset for that step** so the download is not skipped when `CI=true` elsewhere. Local dev: `pnpm run install:browsers`.
