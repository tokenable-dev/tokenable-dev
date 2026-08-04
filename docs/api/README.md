# Backend API Reference

All routes are prefixed with `/api`.  
Base URL examples:
- Local dev: `http://localhost:4100/api` (see [local-setup.md](../guides/local-setup.md))
- Production: `https://tokenable-dev.com/api` ← same-origin via Nginx

**Swagger UI:** `GET /api/docs`  
**Authentication:** `HttpOnly` cookie `access_token` after sign-in, or `Authorization: Bearer <token>`.

When **`SITE_ACCESS_ENABLED=true`**, most routes also require the site-access cookie — see [site-access.md](./site-access.md).

---

## Controller Mapping

| Tag | Controller | Base Path |
|-----|-----------|-----------|
| `privy-auth` | `auth/auth.controller.ts` | `/api/auth` |
| `privy` | `privy/privy-catalog.controller.ts` | `/api/privy` |
| `privy-auth` / `privy-users` / `privy-funding` | `privy/privy-api.controller.ts` | `/api/privy` |
| `rwa` | `rwa/rwa.controller.ts` | `/api/rwa` |
| `blockchain` | `blockchain/blockchain.controller.ts` | `/api/blockchain` |
| `psa` | `psa/psa.controller.ts` | `/api/psa` |
| `marketplace` | `marketplace/orders/orders.controller.ts` | `/api/marketplace` |
| `marketplace` | `marketplace/collections/collections.controller.ts` | `/api/marketplace` |
| `marketplace` | `marketplace/snapshots/collection-market-snapshot.controller.ts` | `/api/marketplace` |
| `marketplace` | `marketplace/portfolio/portfolio.controller.ts` | `/api/marketplace` |
| `marketplace` | `marketplace/watchlist/watchlist.controller.ts` | `/api/marketplace/watchlist` |
| `marketplace` | `marketplace/collections/collections.controller.ts` (+ orders/portfolio/…) | `/api/marketplace` |
| `marketplace-admin` | `marketplace/admin/platform-analytics.controller.ts` | `/api/marketplace/admin/analytics` |
| `marketplace-admin` | `marketplace/admin/user-admin.controller.ts` | `/api/marketplace/admin/users` |
| `marketplace-admin` | `marketplace/admin/marketplace-admin-auth.controller.ts` | `/api/marketplace/admin/auth` |
| `marketplace-admin` | `marketplace/collections/rwa-token-admin.controller.ts` | `/api/marketplace/admin/rwa-tokens` |
| `marketplace-admin` | `rwa/admin/bulk-mint-admin.controller.ts` | `/api/marketplace/admin/bulk-mint` |
| `cardhedger` | `cardhedger/controllers/cardhedger-proxy.controller.ts` | `/api/cardhedger/v1` |
| `cardhedger` | `cardhedger/controllers/card-top100.controller.ts` | `/api/cardhedger/top100` |
| `cardhedger` | `cardhedger/controllers/card-top-movers.controller.ts` | `/api/cardhedger/top-movers` |
| `cardhedger` | `cardhedger/controllers/cardhedger-catalog.controller.ts` | `/api/cardhedger` |
| `webhooks` | `cardhedger/controllers/cardhedger-price-webhook.controller.ts` | `/api/webhooks/cardhedger` |
| `admin` | `cardhedger/admin/cardhedger-admin.controller.ts` | `/api/admin/cardhedger` |
| `admin` | `cardhedger/controllers/cardhedger-price-subscription-admin.controller.ts` | `/api/admin/cardhedger/price-subscriptions` |
| `cardladder` | `cardladder/controllers/cardladder-indexes.controller.ts` | `/api/cardladder` |
| `site-access` | `site-access/site-access.controller.ts` | `/api/site-access` |
| `health` | `health/health.controller.ts` | `/api/health` |

Scoped docs: [auth](./auth.md) · [rwa](./rwa.md) · [blockchain](./blockchain.md) · [psa](./psa.md) · [marketplace](./marketplace.md) · [cardhedger](./cardhedger.md) · [site-access](./site-access.md)

---

## Auth (`/api/auth`)

> **Privy-only** — `POST /api/auth/privy/session` exchanges a Privy access token for the Tokenable `access_token` HttpOnly cookie. Legacy email/password and Google OAuth routes were removed from the controller.

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| **POST** | **`/api/auth/privy/session`** | Bearer Privy | **Privy → Tokenable session** (`privy-access-token` in Swagger) |
| GET | `/api/auth/session` | — | Current session (`{ user: null }` when anonymous — never 401) |
| PATCH | `/api/auth/profile` | JWT | Display name + marketing / email notification prefs |
| POST | `/api/auth/avatar` | JWT | Profile avatar upload (S3, multipart `file`) |
| GET/POST/PATCH/DELETE | `/api/user/shipping-addresses` | JWT | Settings address book (see [auth.md](./auth.md)) |
| POST | `/api/auth/logout` | — | Clear Tokenable cookie (204) |
| POST | `/api/auth/delete-account` | JWT | Delete account (`password` optional — legacy email users only) |

---

## RWA & Blockchain

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| POST | `/api/rwa/upload` | — | Multipart — IPFS upload (Pinata), PSA 10 gate |
| GET | `/api/blockchain/rwa/asset/:tokenId` | — | tokenURI → metadata + imageUrl |
| GET | `/api/blockchain/rwa/token-uri/:tokenId` | — | Raw tokenURI |
| GET | `/api/blockchain/rwa/tokens/:address` | — | TokenId list for address |
| POST | `/api/blockchain/rwa/metadata/batch` | — | Batch metadata + imageUrl |
| POST | `/api/blockchain/media/resolve` | — | Resolve ipfs:// → https |

---

## PSA

Full architecture: **[psa.md](./psa.md)** · Swagger tag `psa` · upstream spec `backend/src/psa/psa-swagger.json`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/psa/analyze` | Multipart slab OCR → PSA + Cardhedger |
| POST | `/api/psa/analyze-by-cert` | JSON `{ certNumber }` |
| GET | `/api/psa/public/cert/:certNumber` | Proxy — GetByCertNumber |
| POST | `/api/psa/public/cert` | Same (Swagger Try it out) |
| GET | `/api/psa/public/cert/:certNumber/file-append` | Proxy — GetByCertNumberForFileAppend |
| POST | `/api/psa/public/cert/file-append` | Same |
| GET | `/api/psa/public/cert/:certNumber/images` | Proxy — GetImagesByCertNumber |
| POST | `/api/psa/public/cert/images` | Same |
| GET | `/api/psa/public/pop/:specId` | Proxy — GetPSASpecPopulation |
| POST | `/api/psa/public/pop` | Same |
| GET | `/api/psa/order/progress/:orderNumber` | Proxy — GetProgress |
| POST | `/api/psa/order/progress` | Same |
| GET | `/api/psa/order/submission-progress/:submissionNumber` | Proxy — GetSubmissionProgress |
| POST | `/api/psa/order/submission-progress` | Same |

---

## Marketplace — Orders

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/marketplace/orders` | Register Seaport order |
| POST | `/api/marketplace/orders/replace-listing` | Cancel old ask + insert new |
| POST | `/api/marketplace/orders/replace-bid` | Replace card-level bid |
| POST | `/api/marketplace/orders/batch-by-token` | Batch order history |
| GET | `/api/marketplace/orders/by-offerer` | Orders by wallet |
| GET | `/api/marketplace/orders` | Active asks (lightweight) |
| GET | `/api/marketplace/orders/token/:tokenId` | Orders for token |
| GET | `/api/marketplace/orders/:hash` | Single order by hash |
| PATCH | `/api/marketplace/orders/:hash/cancel` | Cancel order |
| PATCH | `/api/marketplace/orders/:hash/fulfill` | Mark fulfilled |
| POST | `/api/marketplace/orders/fulfill-matched-pair` | Matched ask + bid fulfilled |

---

## Marketplace — Collections & pricing

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/marketplace/collections` | Collection list (cursor pagination) |
| POST | `/api/marketplace/collections/market-snapshots` | Batch list-row snapshots (DB-first) |
| POST | `/api/marketplace/collections/portfolio-market-batch` | Portfolio batch stats + series |
| POST | `/api/marketplace/collections/on-mint` | Mint webhook — bootstrap collection |
| POST | `/api/marketplace/collections/token-collection-keys` | Batch tokenIds → collection_key |
| POST | `/api/marketplace/cardhedger/mint-previews` | Batch mint previews (max 32) |
| GET | `/api/marketplace/collections/:key` | Collection detail + order book |
| GET | `/api/marketplace/collections/:key/cardhedger` | Cardhedger matched card + bands |
| GET | `/api/marketplace/collections/:key/cardhedger/price-history` | PSA10 price history |
| GET | `/api/marketplace/collections/:key/ai-insight` | AI market brief |
| GET | `/api/marketplace/collections/:key/market-series` | Platform + external chart bundle |
| GET | `/api/marketplace/collections/:key/platform-trades` | Fulfilled listings |
| GET | `/api/marketplace/collections/:key/stats` | Pool stats |
| GET | `/api/marketplace/collections/:key/grade-catalog` | Grade catalog |
| GET | `/api/marketplace/collections/:key/grade-series` | Grade time series |
| GET | `/api/marketplace/collections/:key/merkle-set` | Merkle-eligible tokenIds |
| GET | `/api/marketplace/rwa/:tokenId/trades` | Token trade history |
| GET | `/api/marketplace/collections/admin/review-counts` | Admin: review_status counts |
| POST | `/api/marketplace/collections/:key/admin/review` | Admin: approve/reject collection |
| POST | `/api/marketplace/collections/:key/admin/cover` | Admin: set cover URL |
| POST | `/api/marketplace/collections/:key/admin/cover/upload` | Admin: upload cover to S3 |
| POST | `/api/marketplace/collections/:key/admin/cover/from-token` | Admin: cover from token |
| POST | `/api/marketplace/collections/:key/admin/delete` | Admin: delete collection |

---

## Marketplace — Portfolio & watchlist

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/api/marketplace/portfolio/daily/:wallet` | — | Daily snapshots + 24h P&L (`portfolio_daily_snapshots`) |
| GET | `/api/marketplace/portfolio/hidden/:wallet` | — | Hidden token IDs |
| POST | `/api/marketplace/portfolio/hidden` | — | Hide holding |
| DELETE | `/api/marketplace/portfolio/hidden` | — | Unhide holding |
| POST | `/api/marketplace/portfolio/holdings/batch` | — | Batch hide + cost basis per tokenId |
| PUT | `/api/marketplace/portfolio/holdings/cost-basis` | — | Manual cost basis (never overwritten by auto-seed) |
| GET | `/api/marketplace/watchlist` | JWT | List saved collections (`x-tokenable-chain-id` optional) |
| POST | `/api/marketplace/watchlist` | JWT | Add collection |
| DELETE | `/api/marketplace/watchlist` | JWT | Remove collection |

---

## Marketplace admin

Separate session from user JWT — `POST /api/marketplace/admin/auth/login` sets `marketplace_admin` cookie. Swagger: **marketplace-admin** tag.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/marketplace/admin/auth/session` | Admin session |
| POST | `/api/marketplace/admin/auth/login` | Admin login |
| POST | `/api/marketplace/admin/auth/logout` | Admin logout |
| GET | `/api/marketplace/admin/analytics` | Platform KPIs (`?days=7\|30\|90`) |
| GET | `/api/marketplace/admin/analytics/ga4` | GA4 traffic (when configured) |
| GET | `/api/marketplace/admin/users` | User list + filters |
| GET | `/api/marketplace/admin/users/stats` | User stats |
| GET | `/api/marketplace/admin/users/:id` | User detail |
| GET | `/api/marketplace/admin/rwa-tokens/cards` | All RWA registry cards |
| GET | `/api/marketplace/admin/rwa-tokens/custody-nfts` | Custody delivery queue |
| GET | `/api/marketplace/admin/rwa-tokens/listings` | Listed cards (legacy) |
| PATCH | `/api/marketplace/admin/rwa-tokens/:tokenId` | Update token metadata |
| POST | `/api/marketplace/admin/rwa-tokens/:tokenId/deliver` | Deliver custody NFT to user |
| POST | `/api/marketplace/admin/partners` | Register consignment partner (encrypted PK) |
| GET | `/api/marketplace/admin/partners` | List partners |
| POST | `/api/marketplace/admin/bulk-mint/jobs` | Create partner mint+list job (cert+price, max 500) |
| GET | `/api/marketplace/admin/bulk-mint/jobs/:id` | Bulk mint+list job status (Listed/Sold) |
| POST | `/api/marketplace/admin/bulk-mint/jobs/:id/prepare` | Re-run PSA+IPFS prepare |
| POST | `/api/marketplace/admin/bulk-mint/jobs/:id/commit` | Approve once → mintBatch to partner + Seaport asks |

Collection admin routes (cover/delete) use admin session on `/api/marketplace/collections/:key/admin/*`.

Full ops guide: [marketplace-admin.md](../guides/marketplace-admin.md).

---

## Cardhedger

See **[cardhedger.md](./cardhedger.md)** for full proxy path list, Top 100, Top Movers, and price subscription admin.

---

## Card Ladder

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cardladder/indexes` | Landing dashboard indexes (Playwright scrape + cache) |

---

## Site access & health

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/site-access/verify` | Staging gate password |
| GET | `/api/health` | Liveness probe |

---

For request/response schemas and **Try it out** examples, use **[Swagger UI](http://localhost:4100/api/docs)** (`pnpm start:dev` in `backend/`). Quick flow: health → site-access (if enabled) → `privy/session` or Authorize → marketplace / marketplace-admin.
