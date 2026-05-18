# Cardhedger integration

**Public HTTP:** `GET /api/cardhedger/indexes` — dashboard market indexes (Pokemon, MLB, NFL, NBA), backed by `CardhedgerIndexesService` (scheduled refresh + disk cache).

**Server-to-server:** `CardhedgerService` (`backend/src/cardhedger/cardhedger.service.ts`) calls Cardhedger upstream (`CARDHEDGER_API_KEY`, optional `CARDHEDGER_BASE_URL`) from:

- PSA analyze / mint enrichment (`psa/*`)
- Collection cover resolution and market bundles (`marketplace/collections/*`)
- Indexes aggregation (`cardhedger/indexes.service.ts`)

Former **`/api/cardhedger/v1/*` HTTP proxy controllers** were removed; the frontend does not call those paths. Use **Swagger `/api/docs`** for the current route list.

Optional env: **`CARDHEDGER_PSA_SPECID_MAP`** — JSON map of PSA `specId` → Cardhedger `card_id` (see `psa-spec-cardhedger-map.util.ts`).
