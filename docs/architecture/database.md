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
Collection metadata derived from minted RWAs. Managed by `marketplace-collection.entity.ts`.

| Column | Type | Notes |
|--------|------|-------|
| `collection_key` | varchar PK | SHA-256 of normalized card attributes |
| `card_name` | varchar | |
| `card_set` | varchar | |
| `card_number` | varchar | nullable |
| `grading_company` | varchar | e.g. `psa` |
| `grade_score` | varchar | e.g. `10` |
| `psa_spec_id` | varchar | nullable |
| `psa_total_population` | int | nullable |
| `cardhedger_card_id` | varchar | nullable |
| `cardhedger_search_query` | varchar | nullable |
| `created_at` / `updated_at` | timestamptz | |

### `bids` (Relational layer)
Conditional buy-side orders. Rule evaluated at match time.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `collection_key` | varchar | |
| `token_id` | varchar | nullable |
| `bidder_address` | varchar | |
| `price_usdc` | numeric | |
| `status` | enum | `active/cancelled/expired/matched` |
| `rule` | jsonb | AST — `AND/OR`, `GRADE_MIN`, `TRAIT_INCLUDE_ALL`, `EXTERNAL_MATCH` |
| `snapshot_id` | varchar | nullable |
| `expires_at` | timestamptz | nullable |

### `asks` (Relational layer)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `collection_key` | varchar | |
| `token_id` | varchar | |
| `seller_address` | varchar | |
| `price_usdc` | numeric | |
| `status` | enum | `active/locked/cancelled/matched` |
| `grade` | varchar | nullable |
| `traits` | jsonb | nullable |
| `external_ref` | jsonb | nullable — rule evaluation meta |

### `match_intents`

| Column | Notes |
|--------|-------|
| `id` uuid PK | |
| `bid_id`, `ask_id`, `token_id` | Logical match triple |
| `rule_result` | jsonb |

### `trade_executions`

| Column | Notes |
|--------|-------|
| `id` uuid PK | |
| `execution_state` | `pending → locked → executed / failed` |
| `bid_id`, `ask_id` | Denormalized |
| `token_id` | |
| `in_flight_partial` | unique constraint — prevents double settlement |

### `idempotency_keys`
Deduplication for `POST /marketplace/trade/match`.

### `outbox_events`
Transactional outbox. `OutboxPublisherService` processes items and marks `published`.

### `hidden_assets`
Per-wallet portfolio visibility. Managed by `hidden-assets.service.ts`.

| Column | Notes |
|--------|-------|
| `id` uuid PK | |
| `wallet_address` | |
| `token_id` | int |

## Settlement Worker State Machine

```
POST /trade/match
        │
   TradeOrchestratorService
        │
        ▼
  trade_executions.state = pending
  asks.status = locked
        │
   SettlementProcessorService (worker)
        │
        ├── CAS: pending → locked
        ├── On-chain / stub settlement
        ├── Success → executed, ask = matched
        └── Failure → failed, ask = active (retry eligible)
```

Worker is controlled by env vars:

| Variable | Default | Notes |
|----------|---------|-------|
| `SETTLEMENT_WORKER_ENABLED` | `true` | Set `false` to disable |
| `SETTLEMENT_POLL_MS` | `2000` | Polling interval (ms) |
| `SETTLEMENT_STUB_FAIL` | — | `true` forces all settlements to fail |
| `SETTLEMENT_STUB_FAIL_RATE` | `0` | 0–1 probabilistic failure rate |
| `OUTBOX_PUBLISHER_ENABLED` | `true` | |
| `OUTBOX_PUBLISHER_POLL_MS` | `1500` | |
| `OUTBOX_PUBLISHER_BATCH` | `50` | Items per poll cycle |
