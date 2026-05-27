# Backend Structure

**Source:** `backend/src/`  
**Framework:** NestJS 11 + TypeORM + Ethers.js 6

## Module map

```
backend/src/
├── main.ts                  # Bootstrap: global prefix /api, CORS, ValidationPipe, Swagger
├── app.module.ts            # Root — TypeORM (4 entities), ScheduleModule
│
├── auth/                    # Google OAuth, JWT cookies, wallet link
├── user/                    # users table
├── mail/                    # SMTP (auth verification emails)
├── health/                  # GET /api/health
│
├── rwa/                     # IPFS upload (Pinata) — PSA 10 gate on mint metadata
├── blockchain/              # Sepolia read-only RWA + IPFS gateway resolver
├── psa/                     # Slab OCR, analyze-by-cert, Public API, spec-page scraper
├── cardhedger/              # Upstream client + GET /api/cardhedger/indexes
│
└── marketplace/
    ├── orders/              # Seaport order book (orders table)
    └── collections/
        ├── collections.controller.ts      # List, detail, stats, market-series, …
        ├── cert-market-trace.controller.ts # POST cert-market-trace (debug)
        ├── collection.service.ts          # Buckets, covers, listing enrichment
        ├── collection-market.service.ts   # Pool stats, batch list snapshots
        ├── collection-market-snapshot.service.ts       # Worker refresh / upsert
        ├── collection-market-snapshot-read.service.ts  # DB-first API reads
        ├── collection-market-snapshot-scheduler.service.ts # Cron + SWR queue
        ├── cardhedger-market-data.service.ts
        └── cardhedger-ai-insight.service.ts
```

**Entities (TypeORM):** `User`, `Order`, `MarketplaceCollection`, `CollectionMarketSnapshot` — see [database.md](./database.md).

There is **no** `marketplace/assets` module, relational `BidsController` / `TradeController`, or PokéTrace proxy in the current tree.

## Marketplace data path

```
Ask POST → OrdersService.ensureCollectionForListing → marketplace_collections row
         → snapshot scheduler enqueue → collection_market_snapshots upsert (async/on-demand)

GET …/collections, …/market-snapshots, …/cardhedger, …/price-history
         → CollectionMarketSnapshotReadService (PostgreSQL only on hot path)
```

## Global bootstrap (`main.ts`)

| Setting | Value |
|---------|-------|
| Global prefix | `/api` |
| Swagger UI | `GET /api/docs` |
| ValidationPipe | `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` |
| CORS | `CORS_ORIGIN` (comma-separated); `credentials: true` |
| Cookie parser | `cookie-parser` |
| Default port | `4000` (`PORT` env) |

## Production TypeORM

```typescript
synchronize: NODE_ENV !== 'production' || TYPEORM_SYNC === 'true'
```

Use bootstrap SQL for prod; keep `TYPEORM_SYNC=false` after first schema apply.
