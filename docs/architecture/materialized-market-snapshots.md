# Materialized Market Snapshot Architecture

## Overview

Cardhedger market data is **materialized** in `collection_market_snapshots` and refreshed by background workers. User-facing marketplace routes read PostgreSQL first and do not call Cardhedger upstream on the hot path.

```
Cron / stale-SWR enqueue
  → CollectionMarketSnapshotSchedulerService (in-memory queue; BullMQ-ready)
  → CollectionMarketSnapshotService.refreshSnapshot()
  → Cardhedger upstream (worker only)
  → normalize → upsert collection_market_snapshots

GET /marketplace/collections/market-snapshots
GET /marketplace/collections/:key/market-series
GET /marketplace/collections/:key/cardhedger
GET /marketplace/collections/:key/cardhedger/price-history
  → CollectionMarketSnapshotReadService
  → PostgreSQL read (+ platform trades from orders for market-series)
  → optional stale flag + async refresh enqueue
```

## Separation of concerns

| Store | Purpose |
|-------|---------|
| `marketplace_collections` | Bucket metadata, cover, listing enrichment |
| `collection_market_snapshots` | Cardhedger pricing, preview JSON, external series |
| `orders` | Platform listing pool + fulfilled tape |

## Stale-while-revalidate

1. API returns last-known-good snapshot immediately.
2. If `stale_after <= now()`, response includes `snapshotStale: true`.
3. Scheduler enqueues async refresh — request does not block on Cardhedger.

## Cold start

When no snapshot row exists (new collection / first listing):

- `MARKET_SNAPSHOT_ON_DEMAND=true` (default): one upstream refresh, persist, return.
- Otherwise: empty preview until cron or a later on-demand refresh succeeds.

## Future: BullMQ + Redis

- Replace in-memory queue in `CollectionMarketSnapshotSchedulerService` with BullMQ `Queue.add`.
- Bind `TTL_CACHE_PROVIDER` to a Redis-backed implementation for cross-instance Cardhedger dedupe.
- Run workers as a separate Nest process or container.

## Rollout

1. Bootstrap DB with `backend/sql/scripts/bootstrap-db.sh` or TypeORM sync on first boot.
2. Monitor logs: `market_snapshot_refreshed`, `market_snapshot_refresh_scheduled`.
