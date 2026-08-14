# Backend Structure

**Source:** `backend/src/`  
**Framework:** NestJS 11 + TypeORM + Ethers.js 6

## Marketplace layout

The marketplace domain is organized into **six submodules**:

| Submodule | Role |
|-----------|------|
| `marketplace/orders/` | Seaport order book CRUD |
| `marketplace/collections/` | Bucket metadata, listing enrichment, merkle set, **identity cache**, RWA token admin |
| `marketplace/market-data/` | Cardhedger resolve / pricing / mint previews / AI insight |
| `marketplace/snapshots/` | Materialized `collection_market_snapshots` (write, read, cron) |
| `marketplace/portfolio/` | Daily wallet snapshots + hidden-holdings preference |
| `marketplace/watchlist/` | Per-user saved collections |
| `marketplace/admin/` | Marketplace admin auth (username/password, separate from `users`) |

Cross-cutting:

- **`CollectionIdentityService`** — canonical writer for `components.cardhedgerCardId` with L1 in-process + L2 Redis cache, row-lock precedence, write-through invalidation.
- **`CardhedgerResolveService`** — Cardhedger card-search resolution.
- **`CardhedgerAdminModule`** — ops health + Prometheus scrape (`/api/admin/cardhedger/*`).
- **`CardhedgerPriceInfraModule`** — price webhook receiver, subscription sync, nightly delta import.
- **`common/cache/`** — global in-memory TTL cache (`TTL_CACHE_PROVIDER`).
- **`common/metrics/`** — Cardhedger operational counters.
- **`common/perf/`** — lightweight JSON stdout performance logging.

---

## Module map

```
backend/src/
├── main.ts                  # Bootstrap: global prefix /api, helmet, compression, CORS, ValidationPipe, Swagger, perf logger
├── app.module.ts            # Root — TypeORM (22 entities), ScheduleModule, EventEmitter, CacheModule
│
├── config/
│   ├── app.config.ts
│   ├── marketplace.config.ts
│   └── cardladder.config.ts
│
├── common/
│   ├── cache/               # Global MemoryTtlCacheProvider (TTL_CACHE_PROVIDER)
│   ├── metrics/             # CardhedgerMetricsModule
│   └── perf/                # perfNow, perfLog, elapsedMs
│
├── auth/                    # Privy JWT session; JWT cookies (`POST /auth/privy/session`)
│   └── privy/               # PrivyService — JWKS verify, user fetch, profile parse
├── privy/                   # Privy catalog endpoint + API proxy (users, funding)
├── kyc/                     # Sumsub WebSDK tokens + webhook → users.kyc_status
├── user/                    # users, user_wallets, user_auth_providers, user_kyc_events
├── health/                  # GET /api/health
├── site-access/             # Optional staging gate middleware + POST verify
│
├── rwa/                     # IPFS upload (Pinata), platform-signed mint, redeem-request
│   ├── rwa.controller.ts    # POST /upload, /mint, /redeem-request
│   ├── rwa.service.ts       # IPFS upload logic + PSA 10 gate
│   ├── rwa-mint.service.ts  # Vault cycle + mint (custody default; direct for self vault)
│   ├── rwa-redeem.service.ts
│   ├── bulk-mint/           # Partner bulk mint jobs
│   └── admin/               # Bulk-mint admin controller
│
├── vault/                   # Physical card vault lifecycle — DB orchestration only
│   ├── vault.service.ts     # VaultAsset, VaultCycle, VaultRedemption state machine
│   ├── vault-submissions.*  # User vault intake (JWT)
│   └── entities/
│
├── blockchain/              # Multi-chain reads + IPFS + write operations
│   ├── blockchain.service.ts
│   ├── rwa-chain-writer.service.ts
│   ├── chain-config.service.ts
│   ├── payment-escrow-writer.service.ts
│   └── ipfs-gateway-resolver.service.ts
│
├── psa/                     # Slab OCR, analyze-by-cert, PSA Public API
│
├── cardhedger/              # Upstream HTTP client + public controllers
│   ├── api-1.json           # OpenAPI source for proxy codegen
│   ├── controllers/
│   ├── admin/
│   └── cardhedger-price-infra.module.ts
│
├── cardladder/              # Card Ladder indexes (Playwright scrape)
│
└── marketplace/             # MarketplaceModule facade
    ├── admin/               # Admin auth, user admin, analytics, vault-submissions admin
    ├── entities/
    ├── utils/
    ├── orders/
    ├── collections/         # Buckets, market reads, identity cache (live)
    │   └── testing/         # Identity-cache chaos/replay harnesses (specs only)
    ├── market-data/
    ├── snapshots/
    ├── portfolio/
    ├── watchlist/
    ├── p2p/
    ├── partners/
    └── notifications/
```

**Entities (TypeORM):** `User`, `UserWallet`, `UserAuthProvider`, `UserKycEvent`, `Order`, `MarketplaceCollection`, `CollectionMarketSnapshot`, `RwaToken`, `PortfolioDailySnapshot`, `PortfolioHolding`, `UserWatchlist`, `MarketplaceAdmin`, `MarketplacePartner`, `MarketplaceNotification`, P2P entities, Cardhedger price infra entities, `VaultAsset`, `VaultCycle`, `VaultRedemption`, `VaultSubmission` — see [database.md](./database.md).

---

## Authentication

**Active:** Privy-only. `auth.controller.ts` exposes:

| Route | Purpose |
|-------|---------|
| `POST /api/auth/privy/session` | Exchange Privy access token → Tokenable JWT cookie |
| `GET /api/auth/session` | Current session (never 401; returns `{ user: null }` if anonymous) |
| `POST /api/auth/logout` | Clear cookie |
| `POST /api/auth/delete-account` | Delete account (JWT) |

**Removed:** legacy `register` / `login` / Google OAuth / email verification / password-reset routes **and** the unused SMTP `mail/` module.

**Admin auth:** Separate username/password (`marketplace_admins` table) → `marketplace_admin` HMAC cookie.

**Guard:** Single `JwtAuthGuard` for user routes. Admin routes use `MarketplaceAdminService.assertAdminSession()`.

---

## Vault NFT Flow

```
POST /api/rwa/upload
  → Pinata IPFS upload → tokenURI

POST /api/rwa/mint  (JWT required)
  → VaultService.reserveCycleForDeposit()
  → RwaChainWriterService.mintTo(custodyWallet | recipient, tokenURI, vaultRef)
     (deliveryMode=custody default; direct for self vault)
  → VaultService.recordMintResult()
  → returns { tokenId, txHash, custodyWallet, mintedTo, intendedRecipient, deliveryMode }

POST /api/marketplace/admin/rwa-tokens/:id/deliver  (custody path only)
  → RwaChainWriterService.safeTransferFromCustody(tokenId, userPrimaryWallet)

POST /api/rwa/redeem-request  (JWT required)
  → VaultService.requestRedemption()

POST /api/marketplace/admin/rwa-tokens/:id/burn
  → RwaChainWriterService.adminBurn()
  → VaultService.completeRedemptionBurn()
```

Detail: [vault-lifecycle.md](./vault-lifecycle.md).

---

## Marketplace data paths

### Listing → bucket → snapshot

```
Ask POST → OrdersService.ensureCollectionForListing
         → marketplace_collections + rwa_tokens
         → CollectionIdentityService (optional cardhedgerCardId from mint metadata)
         → snapshot scheduler enqueue → collection_market_snapshots upsert (async)
```

### Hot read path (charts / markets list)

```
GET …/collections, POST …/market-snapshots
         → CollectionMarketSnapshotReadService (PostgreSQL only)
         → stale row → enqueue SWR refresh (non-blocking)
```

### Portfolio

```
09:00 KST cron → PortfolioDailySnapshotSchedulerService
         → ownerOf scan + batch Cardhedger pricing → portfolio_daily_snapshots upsert

GET …/portfolio/daily/:wallet
         → list snapshots; fallback capture only if today's row missing
         (holdings-change recapture is write-path: mint / fill / deliver / hide / burn)
```

---

## Identity cache (collections)

| Layer | Implementation | When |
|-------|----------------|------|
| L1 | In-process `Map` + hot-key LRU | Always |
| L2 | Redis (`REDIS_URL`) | When configured |
| DB | `marketplace_collections.components.cardhedgerCardId` | Source of truth |

**Write precedence:** stored valid ID > mint metadata > PSA cert lookup > Cardhedger search.

All writes use `SELECT … FOR UPDATE` on the collection row — multi-pod safe.

---

## Global bootstrap (`main.ts`)

| Setting | Value |
|---------|-------|
| Global prefix | `/api` |
| Swagger UI | `GET /api/docs` |
| ValidationPipe | `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` |
| Security headers | `helmet` (`contentSecurityPolicy: false`, `crossOriginEmbedderPolicy: false`) |
| Compression | `compression()` — gzip responses |
| CORS | `CORS_ORIGIN` (comma-separated); `credentials: true` |
| Default port | `4000` (`PORT` env; local dev defaults to `4100`) |
| Perf logger | HTTP request duration logged when `PERF_LOG=true` |
| Trust proxy | `app.set('trust proxy', 1)` — nginx hop; `req.ip` = real client for throttling |
| Rate limiting | Global `@nestjs/throttler` guard, 300 req/min per IP (see `docs/security.md`) |

## Multi-chain support

`ChainConfigService` resolves per-chain RPC, RWA contract, and USDC addresses.

| Chain ID | Network | Notes |
|----------|---------|-------|
| `11155111` | Ethereum Sepolia | Default dev chain |
| `1` | Ethereum mainnet | Production chain |

Chain ID is read from `x-tokenable-chain-id` header; falls back to `DEFAULT_CHAIN_ID`.

## Production TypeORM

```typescript
synchronize: NODE_ENV !== 'production'
```

Use bootstrap SQL for prod; do not rely on `synchronize` in production.

Connection pool is bounded: `max` = `DB_POOL_MAX` (default 20), `idleTimeoutMillis: 30_000`, `connectionTimeoutMillis: 8_000`. A traffic spike queues checkouts inside the app instead of exhausting Postgres `max_connections`.

## Module dependencies (key relationships)

```mermaid
flowchart TB
    MM[MarketplaceModule]
    MD[MarketplaceMarketDataModule]
    SN[MarketplaceSnapshotsModule]
    CO[MarketplaceCollectionsModule]
    OR[MarketplaceOrdersModule]
    VM[VaultModule]
    RM[RwaModule]
    BM[BlockchainModule]
    UM[UserModule]

    RM --> VM
    RM --> BM
    CO --> VM
    CO --> BM
    CO --> UM
    MM --> MD
    MM --> SN
    MM --> CO
    MM --> OR
    SN <-->|forwardRef| CO
```
