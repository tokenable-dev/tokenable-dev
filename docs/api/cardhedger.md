# Cardhedger integration

**Public HTTP:** `GET /api/cardhedger/indexes` — dashboard market indexes (Pokemon, MLB, NFL, NBA), backed by `CardhedgerIndexesService` (scheduled refresh + disk cache).

**Server-to-server:** `CardhedgerService` (`backend/src/cardhedger/cardhedger.service.ts`) calls Cardhedger upstream (`CARDHEDGER_API_KEY`, optional `CARDHEDGER_BASE_URL`) from:

- PSA analyze / mint enrichment (`psa/*`)
- Collection cover resolution and **materialized market snapshots** (`collection_market_snapshots` via snapshot workers — not pull-on-read per request)
- Indexes aggregation (`cardhedger/indexes.service.ts`)

Former **`/api/cardhedger/v1/*` HTTP proxy controllers** were removed; the frontend does not call those paths. Use **Swagger `/api/docs`** for the current route list.

Optional env: **`CARDHEDGER_PSA_SPECID_MAP`** — JSON map of PSA `specId` → Cardhedger `card_id` (see `psa-spec-cardhedger-map.util.ts`).

**PSA Variety vs parallel pricing:** Same player/# can map to different Cardhedger rows (Base vs Silver, etc.). See **[Cardhedger + PSA Variety guide](../guides/cardhedger-psa-variety.md)**.
