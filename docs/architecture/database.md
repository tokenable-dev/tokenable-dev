# Database

**Engine:** PostgreSQL 16  
**ORM:** TypeORM (NestJS)

## Schema Overview

Tables are auto-created at backend startup via `synchronize: true` in non-production environments.  
For production, apply `backend/sql/bootstrap-empty-prod-db.sql` once, then set `TYPEORM_SYNC=false`.

## Tables

### `users`
Managed by `user.entity.ts` + `UserService`.

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

### `orders`
Seaport off-chain order book. Managed by `order.entity.ts`.

| Column | Type | Notes |
|--------|------|-------|
| `hash` | varchar PK | Seaport order hash |
| `side` | enum `ask/bid` | |
| `status` | enum `active/cancelled/fulfilled` | |
| `token_contract` | varchar | |
| `token_id` | varchar | `"0"` for criteria bids |
| `collection_key` | varchar | nullable |
| `consideration_token` | varchar | USDC address |
| `consideration_amount` | varchar | USDC raw (6 decimals) |
| `offerer` | varchar | |
| `parameters` | jsonb | Full Seaport parameters |
| `signature` | text | Seaport EIP-712 signature |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `marketplace_collections`
Collection buckets derived from graded RWA metadata. Managed by `marketplace-collection.entity.ts`.

| Column | Type | Notes |
|--------|------|-------|
| `collection_key` | varchar PK | `computeMarketBucketKey(components)` |
| `display_label` | varchar | Human-readable title |
| `query_used` | text | Cardhedger search text (nullable) |
| `components` | jsonb | Bucket fields + enrichments (`psaSpecId`, `cardhedgerCardId`, …) |
| `cover_image_url` | text | nullable — catalog / PSA spec / gateway URL |
| `created_at` | timestamptz | |

### ~~Relational layer tables (removed)~~

Older revisions documented `bids`, `asks`, `match_intents`, `trade_executions`, `idempotency_keys`, and `outbox_events`. Those TypeORM entities and HTTP routes are **no longer in this repository**. If an old database still contains these tables, they are unused; dev DBs with `synchronize` may drop them when entities are removed.

### `hidden_assets`
Per-wallet portfolio visibility. Managed by `hidden-assets.service.ts`.

| Column | Notes |
|--------|-------|
| `id` uuid PK | |
| `wallet_address` | |
| `token_id` | int |

## Historical note

Settlement-worker documentation (`SETTLEMENT_WORKER_ENABLED`, `OutboxPublisherService`, etc.) applied to the **removed** relational trading layer and is no longer accurate for this codebase.

---

_End of current schema overview._
