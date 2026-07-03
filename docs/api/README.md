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
| `auth` | `auth/auth.controller.ts` | `/api/auth` |
| `privy` | `privy/privy-api.controller.ts` | `/api/privy` |
| `rwa` | `rwa/rwa.controller.ts` | `/api/rwa` |
| `blockchain` | `blockchain/blockchain.controller.ts` | `/api/blockchain` |
| `psa` | `psa/psa.controller.ts` | `/api/psa` |
| `marketplace` | `marketplace/orders/orders.controller.ts` | `/api/marketplace` |
| `marketplace` | `marketplace/collections/collections.controller.ts` | `/api/marketplace` |
| `marketplace` | `marketplace/snapshots/collection-market-snapshot.controller.ts` | `/api/marketplace` |
| `marketplace` | `marketplace/portfolio/portfolio.controller.ts` | `/api/marketplace` |
| `marketplace` | `marketplace/watchlist/watchlist.controller.ts` | `/api/marketplace/watchlist` |
| `marketplace` | `marketplace/collections/cert-market-trace.controller.ts` | `/api/marketplace` |
| `marketplace` | `marketplace/collections/rwa-token-admin.controller.ts` | `/api/marketplace/admin/rwa-tokens` |
| `marketplace` | `marketplace/admin/marketplace-admin-auth.controller.ts` | `/api/marketplace/admin/auth` |
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

> **Primary auth flow** — Privy: `POST /api/auth/privy/session` (frontend exchanges Privy access token for an HTTP-only JWT cookie). Legacy email/password and Google OAuth routes remain for backward compatibility.

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| **POST** | **`/api/auth/privy/session`** | — | **Privy auth — exchange Privy access token → JWT cookie** |
| GET | `/api/auth/session` | — | Current session (`user: null` if anonymous) |
| GET | `/api/auth/me` | JWT | Current authenticated user |
| POST | `/api/auth/logout` | — | Clear cookie (204) |
| POST | `/api/auth/delete-account` | JWT | Delete account |
| POST | `/api/auth/register` | — | *(Legacy)* Email/password registration |
| POST | `/api/auth/login` | — | *(Legacy)* Email/password login → JWT cookie |
| GET | `/api/auth/google` | — | *(Legacy)* Initiate Google OAuth |
| GET | `/api/auth/google/callback` | — | *(Legacy)* OAuth callback → JWT cookie |
| GET | `/api/auth/verify-email` | — | *(Legacy)* Email verification link (`?token=`) |
| POST | `/api/auth/forgot-password` | — | *(Legacy)* Request password reset email |
| POST | `/api/auth/reset-password` | — | *(Legacy)* Reset password with token |
| POST | `/api/auth/change-password` | JWT | *(Legacy)* Change password (logged in) |
| GET | `/api/auth/wallet/challenge` | JWT | *(Legacy)* Wallet link challenge — Privy users unlink via Privy SDK |
| POST | `/api/auth/wallet` | JWT | *(Legacy)* Link wallet (SIWE signature) |
| DELETE | `/api/auth/wallet` | JWT | *(Legacy)* Unlink wallet |

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
| POST | `/api/marketplace/orders/replace-bid` | Replace criteria bid |
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
| POST | `/api/marketplace/cert-market-trace` | Debug cert → PSA → Cardhedger trace |
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
| POST | `/api/marketplace/collections/:key/admin/cover` | Admin: set cover URL |
| POST | `/api/marketplace/collections/:key/admin/cover/from-token` | Admin: cover from token |
| POST | `/api/marketplace/collections/:key/admin/delete` | Admin: delete collection |

---

## Marketplace — Portfolio & watchlist

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/api/marketplace/portfolio/daily/:wallet` | — | Daily snapshots + P&L |
| GET | `/api/marketplace/portfolio/hidden/:wallet` | — | Hidden token IDs |
| POST | `/api/marketplace/portfolio/hidden` | — | Hide holding |
| DELETE | `/api/marketplace/portfolio/hidden` | — | Unhide holding |
| GET | `/api/marketplace/watchlist` | JWT | List saved collections |
| POST | `/api/marketplace/watchlist` | JWT | Add collection |
| DELETE | `/api/marketplace/watchlist` | JWT | Remove collection |

---

## Marketplace admin

Separate session from user JWT — `/api/marketplace/admin/auth/*`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/marketplace/admin/auth/session` | Admin session |
| POST | `/api/marketplace/admin/auth/login` | Admin login |
| POST | `/api/marketplace/admin/auth/logout` | Admin logout |
| GET | `/api/marketplace/admin/rwa-tokens/listings` | RWA token admin list |
| PATCH | `/api/marketplace/admin/rwa-tokens/:tokenId` | Update token metadata fields |
| POST | `/api/marketplace/admin/rwa-tokens/:tokenId/preview-metadata-image` | Preview image fix |

Collection admin routes (cover/delete) use `?adminWallet=` on `/api/marketplace/collections/:key/admin/*`.

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

For request/response schemas, use **[Swagger UI](http://localhost:4100/api/docs)** or the scoped reference pages above.
