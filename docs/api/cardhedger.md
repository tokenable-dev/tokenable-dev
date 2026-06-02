# Cardhedger integration

**Public HTTP:** `GET /api/cardhedger/indexes` — dashboard market indexes (Pokemon, MLB, NFL, NBA), backed by `CardhedgerIndexesService` (scheduled refresh + disk cache).

**Admin / ops HTTP** (requires `?adminWallet=` in `MARKETPLACE_ADMIN_WALLETS`):

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/cardhedger/health` | Circuit + resolve metrics + scheduler state |
| GET | `/api/admin/cardhedger/circuit` | Circuit breaker only |
| GET | `/api/admin/cardhedger/metrics` | Resolve path + scheduler counters (JSON) |
| GET | `/api/admin/cardhedger/prometheus` | Prometheus text scrape |

**Server-to-server:** `CardhedgerService` (`backend/src/cardhedger/cardhedger.service.ts`) calls Cardhedger upstream (`CARDHEDGER_API_KEY`, optional `CARDHEDGER_BASE_URL`) from:

- PSA analyze / mint enrichment (`psa/*`)
- **`CardhedgerResolveService`** — card-search resolution (5-min TTL cache via `TTL_CACHE_PROVIDER`)
- **`CardhedgerPricingService`** — preview, comps, tier history (snapshot workers)
- **`CardhedgerMintService`** — portfolio mint-previews batch
- **`CollectionIdentityService`** — cert lookup + search writes to `components.cardhedgerCardId`
- Indexes aggregation (`cardhedger/indexes.service.ts`)

Market-data logic was split from a single god service into **resolve / pricing / mint** under `marketplace/market-data/`. `CardhedgerMarketDataService` remains the facade used by collections and snapshots.

Former **`/api/cardhedger/v1/*` HTTP proxy controllers** were removed; the frontend does not call those paths. Use **Swagger `/api/docs`** for the current route list.

Optional env: **`CARDHEDGER_PSA_SPECID_MAP`** — JSON map of PSA `specId` → Cardhedger `card_id` (see `psa-spec-cardhedger-map.util.ts`).

**PSA Variety vs parallel pricing:** Same player/# can map to different Cardhedger rows (Base vs Silver, etc.). See **[Cardhedger + PSA Variety guide](../guides/cardhedger-psa-variety.md)**.
