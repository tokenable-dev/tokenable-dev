# Cardhedger integration

Cardhedger is integrated in **three layers**:

1. **HTTP proxy** — frontend calls `/api/cardhedger/v1/*`; backend injects `CARDHEDGER_API_KEY`
2. **First-party services** — Top 100, Top Movers, snapshot workers, identity resolution
3. **Price infra** — webhooks, subscriptions, nightly delta import (admin)

**Env:** `CARDHEDGER_API_KEY` (required), optional `CARDHEDGER_BASE_URL`

---

## Public HTTP routes

### Full upstream proxy

**Controller:** `cardhedger/controllers/cardhedger-proxy.controller.ts`  
**Base:** `/api/cardhedger/v1/*`

Mirrors Cardhedger OpenAPI (`backend/src/api-1.json`). Key endpoints used by the frontend:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/cardhedger/v1/cards/top-movers` | Weekly price gain leaders (1h cache) |
| POST | `/api/cardhedger/v1/cards/card-search` | Card search |
| POST | `/api/cardhedger/v1/cards/prices-by-cert` | Price by PSA cert |
| POST | `/api/cardhedger/v1/cards/fmv-by-cert` | FMV by cert |
| POST | `/api/cardhedger/v1/cards/comps` | Comparable sales |
| POST | `/api/cardhedger/v1/cards/card-fmv` | Card FMV |
| … | … | See Swagger `/api/docs` tag `cardhedger` |

### Top 100 (daily snapshot)

**Controller:** `card-top100.controller.ts`  
**Base:** `/api/cardhedger/top100`

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/cardhedger/top100/categories` | Available categories |
| GET | `/api/cardhedger/top100/:category` | Today's rank list (PSA 10 default) |
| GET | `/api/cardhedger/top100/:category/history` | Historical snapshot dates |
| POST | `/api/cardhedger/top100/:category/refresh` | Force refresh (admin wallet query) |
| POST | `/api/cardhedger/top100/refresh-all` | Refresh all categories |
| POST | `/api/cardhedger/top100/discover-categories` | Discover new categories from upstream |

Data persisted in **`card_top100_daily_snapshots`** (one row per KST date × category × grade).

### Top Movers (cached proxy)

**Controller:** `card-top-movers.controller.ts`

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/cardhedger/top-movers` | Cached top movers (`?count`, `?category`) |
| POST | `/api/cardhedger/top-movers/refresh` | Invalidate cache |

### Catalog routes manifest

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/cardhedger/routes` | Lists available Cardhedger proxy paths |

---

## Server-to-server (no public HTTP)

`CardhedgerService.forwardJson` is also called internally from:

- PSA analyze / mint enrichment (`psa/*`)
- **`CardhedgerResolveService`** — card-search resolution (5-min TTL cache)
- **`CardhedgerPricingService`** — preview, comps, tier history (snapshot workers)
- **`CardhedgerMintService`** — portfolio mint-previews batch
- **`CollectionIdentityService`** — cert lookup + search writes to `components.cardhedgerCardId`

Market-data logic lives under `marketplace/market-data/`. `CardhedgerMarketDataService` is the facade used by collections and snapshots.

---

## Price webhooks & subscriptions

**Webhook:** `POST /api/webhooks/cardhedger/price-updates` (public when site-access enabled)

**Admin:** `/api/admin/cardhedger/price-subscriptions/*` — subscription sync, nightly delta runs, status. See Swagger tag `admin`.

Tables: `cardhedger_price_subscriptions`, `cardhedger_price_delta_checkpoints`, `cardhedger_daily_price_export_runs`, `cardhedger_price_delta_import_runs`.

---

## Admin / ops HTTP

Requires `?adminWallet=` in `MARKETPLACE_ADMIN_WALLETS`:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/cardhedger/health` | Circuit + resolve metrics + scheduler state |
| GET | `/api/admin/cardhedger/circuit` | Circuit breaker only |
| GET | `/api/admin/cardhedger/metrics` | Resolve + scheduler counters (JSON) |
| GET | `/api/admin/cardhedger/prometheus` | Prometheus text scrape |

---

## PSA Variety vs parallel pricing

Same player/# can map to different Cardhedger rows (Base vs Silver, Master Ball vs Reverse Foil, etc.). See **[Cardhedger + PSA Variety guide](../guides/cardhedger-psa-variety.md)**.

Cert lookup `card_id` is used only when the catalog **variant** is compatible with PSA **Variety**. Otherwise resolve falls through to `card-search`. Stored catalog IDs are re-validated the same way. Mint preview, collection attach, and trades-tape comps use this gate — they do not take a cert batch price when the cert row is a sibling finish (e.g. Reverse Foil on a Master Ball slab).

Card ID resolution uses **`CollectionIdentityService`** (cert lookup + search). The old `CARDHEDGER_PSA_SPECID_MAP` env override was removed.

---

## UI feature flags

Public Top 100 / Top Movers sections may be disabled in the frontend via `lib/markets/top100Copy.ts` while admin preview remains on **`/marketplace/admin/markets`** (tabbed: home landing, Top 100, Cardhedger movers).
