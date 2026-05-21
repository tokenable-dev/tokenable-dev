# Database

**Engine:** PostgreSQL 16  
**ORM:** TypeORM (NestJS) — entities are the source of truth; DDL mirrors live under `backend/sql/schema/`.

## Schema overview

Four application tables. Legacy relational trading tables (`bids`, `asks`, `match_intents`, …) and `hidden_assets` are **not** in the current codebase.

```
users
marketplace_collections          ← bucket metadata (created on first ask)
collection_market_snapshots      ← materialized Cardhedger pricing (worker upsert)
orders                           ← Seaport signed asks/bids + fulfilled tape
```

### How data flows

| Event | Tables touched |
|-------|----------------|
| Google login | `users` |
| First **ask** listing for a token | `orders` + insert `marketplace_collections` (from IPFS graded metadata) |
| Snapshot worker / on-demand refresh | upsert `collection_market_snapshots` (+ optional audit columns on `marketplace_collections`) |
| List / cancel / fulfill | `orders` only |
| Markets UI read | `marketplace_collections` + `collection_market_snapshots` + `orders` (pool stats) |

Cardhedger is **not** called on the hot read path for collection charts — see [materialized-market-snapshots.md](./materialized-market-snapshots.md).

---

## Bootstrap & sync

| Environment | Approach |
|-------------|----------|
| **Local dev** | `NODE_ENV !== production` → TypeORM `synchronize: true` on backend boot |
| **Production / empty DB** | Run `backend/sql/scripts/bootstrap-db.sh` once, then `TYPEORM_SYNC=false` |

Details: [backend/sql/README.md](../../backend/sql/README.md) · [guides/deployment.md](../guides/deployment.md)

---

## Tables

### `users`

Google OAuth accounts + optional linked wallet. Entity: `user.entity.ts`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `email` | varchar | unique |
| `name` | varchar | nullable |
| `picture_url` | varchar | nullable |
| `wallet_address` | varchar | nullable, EIP-55 checksum |
| `wallet_linked_at` | timestamptz | nullable |
| `platform_email_verified_at` | timestamptz | nullable |
| `created_at` | timestamptz | |

---

### `marketplace_collections`

Logical **bucket** derived from graded RWA metadata (`computeMarketBucketKey`). Created when the first **ask** is registered, not at mint time. Entity: `marketplace-collection.entity.ts`.

| Column | Type | Notes |
|--------|------|-------|
| `collection_key` | varchar(64) PK | SHA-256 hex bucket key |
| `display_label` | varchar | Human-readable title |
| `query_used` | text | Cardhedger search text (nullable) |
| `components` | jsonb | Bucket fields + enrichments (`cardhedgerCardId`, `psaCertNumber`, `listingDisplayTitle`, PSA fields, …) |
| `cover_image_url` | text | Catalog / PSA spec / gateway URL (nullable) |
| `cardhedger_resolved_card_id` | varchar(64) | Audit mirror from last snapshot refresh |
| `cardhedger_headline_usd` | double precision | Last published headline USD (audit) |
| `cardhedger_spot_basis` | varchar(32) | e.g. `comps`, `latest_sale` |
| `cardhedger_pricing_synced_at` | timestamptz | |
| `psa_cert_number` | varchar(32) | Canonical cert from listing metadata |
| `psa_public_snapshot_json` | jsonb | Cached PSA Public API body (nullable) |
| `psa_public_snapshot_at` | timestamptz | |
| `created_at` | timestamptz | |

**Canonical pricing for API reads** lives in `collection_market_snapshots`, not denormalized Cardhedger columns here.

---

### `collection_market_snapshots`

Materialized Cardhedger market state per `collection_key`. Entity: `collection-market-snapshot.entity.ts`.

| Column | Type | Notes |
|--------|------|-------|
| `collection_key` | varchar(64) PK | FK-aligned with `marketplace_collections` (logical, not enforced) |
| `cardhedger_card_id` | varchar(64) | Resolved catalog id |
| `psa10_usd`, `psa9_usd`, `raw_usd`, `headline_usd` | double precision | Grade strip / headline |
| `change_7d_pct`, `change_30d_pct` | double precision | Window deltas |
| `sparkline_90d_json` | jsonb | Compact sparkline |
| `preview_json` | jsonb | Full Cardhedger preview payload for API |
| `external_usd_json` | jsonb | External USD series (~365d) — serves `price-history` / `market-series` |
| `grade_prices_json` | jsonb | Per-grade strip |
| `category_label` | varchar(512) | List-row category |
| `history_tier` | varchar(32) | History depth label |
| `reliability_score` | smallint | 0–100 |
| `market_state` | varchar(16) | `fresh` \| `stale` \| `error` \| `empty` |
| `synced_at`, `stale_after` | timestamptz | SWR freshness |
| `source_version` | smallint | Normalization version (bump on schema changes) |
| `last_viewed_at` | timestamptz | Scheduler prioritization |
| `last_refresh_error` | text | Last worker error |
| `created_at`, `updated_at` | timestamptz | |

Worker env vars: [backend/sql/README.md](../../backend/sql/README.md#snapshot-worker-env) · [materialized-market-snapshots.md](./materialized-market-snapshots.md)

---

### `orders`

Seaport off-chain order book. Entity: `order.entity.ts`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `order_hash` | varchar | unique — Seaport order hash |
| `offerer` | varchar | |
| `side` | varchar | `ask` \| `bid` |
| `status` | varchar | `active` \| `fulfilled` \| `cancelled` \| `expired` |
| `token_contract` | varchar | RWA contract |
| `token_id` | varchar | `"0"` for ERC721_WITH_CRITERIA bids |
| `collection_key` | varchar(64) | nullable — set for asks when bucket metadata resolves; required for criteria bids |
| `consideration_token` | varchar | USDC address |
| `consideration_amount` | varchar | USDC raw (6 decimals, stringified) |
| `parameters` | jsonb | Full Seaport parameters |
| `signature` | text | EIP-712 signature |
| `start_time`, `end_time` | timestamptz | |
| `created_at`, `updated_at` | timestamptz | |

Partial indexes (see `040_orders.sql`): active asks and fulfilled asks per `collection_key` for pool stats and charts.

---

## Removed / historical

| Artifact | Status |
|----------|--------|
| `bids`, `asks`, `match_intents`, `trade_executions`, `idempotency_keys`, `outbox_events` | Removed — settlement workers and relational HTTP API no longer exist |
| `hidden_assets` / `GET …/my-assets/hidden` | Removed from codebase — portfolio uses on-chain token list only |
| Pull-on-read Cardhedger bundle cache tables | Removed — replaced by `collection_market_snapshots` |
| `SETTLEMENT_WORKER_*`, `OutboxPublisherService` docs | Obsolete |

Old DB volumes may still contain orphan tables; they are unused. After entity removal, dev `synchronize: true` may drop them.

---

## Related docs

- [materialized-market-snapshots.md](./materialized-market-snapshots.md) — read path, SWR, workers
- [api/marketplace.md](../api/marketplace.md) — HTTP API over these tables
- [guides/troubleshooting.md](../guides/troubleshooting.md) — bootstrap & “relation does not exist”
