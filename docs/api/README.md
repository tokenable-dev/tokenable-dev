# Backend API Reference

All routes are prefixed with `/api`.  
Base URL examples:
- Local: `http://localhost:4000/api`
- Production: `https://tokenable-dev.com/api`  ← same-origin via Nginx

**Swagger UI:** `GET /api/docs`  
**Authentication:** `HttpOnly` cookie `access_token` issued after Google OAuth, or `Authorization: Bearer <token>`.

---

## Controller Mapping

| Tag | Controller | Base Path |
|-----|-----------|-----------|
| `auth` | `auth/auth.controller.ts` | `/api/auth` |
| `rwa` | `rwa/rwa.controller.ts` | `/api/rwa` |
| `blockchain` | `blockchain/blockchain.controller.ts` | `/api/blockchain` |
| `psa` | `psa/psa.controller.ts` | `/api/psa` |
| `marketplace` | `marketplace/orders/orders.controller.ts` | `/api/marketplace` |
| `marketplace` | `marketplace/collections/collections.controller.ts` | `/api/marketplace` |
| `marketplace` | `marketplace/assets/assets.controller.ts` | `/api/marketplace` |
| `marketplace` | `marketplace/trading/bids.controller.ts` | `/api/marketplace/bids` |
| `marketplace` | `marketplace/trading/trade.controller.ts` | `/api/marketplace/trade` |
| `cardhedger` | `cardhedger/controllers/catalog.controller.ts` | `/api/cardhedger` |
| `cardhedger` | `cardhedger/controllers/indexes.controller.ts` | `/api/cardhedger` |
| `cardhedger` | `cardhedger/controllers/*.controller.ts` | `/api/cardhedger/v1/cards` |

---

## Route Summary

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/api/auth/google` | — | Initiate Google OAuth |
| GET | `/api/auth/google/callback` | — | OAuth callback → JWT cookie → frontend redirect |
| GET | `/api/auth/verify-email` | — | Email verification link (`?token=`) |
| POST | `/api/auth/send-verification-email` | JWT | Resend verification email |
| GET | `/api/auth/session` | — | Current session (200 + `user: null` for unauthenticated) |
| GET | `/api/auth/me` | JWT | Current user (401 if unauthenticated) |
| POST | `/api/auth/logout` | — | Clear cookie (204) |
| POST | `/api/auth/wallet` | JWT | Link wallet address to account |
| DELETE | `/api/auth/wallet` | JWT | Unlink wallet address |
| POST | `/api/rwa/upload` | — | Multipart — upload image + metadata to IPFS (Pinata) |
| GET | `/api/blockchain/token/info` | — | USDC name, symbol, decimals |
| GET | `/api/blockchain/token/supply` | — | USDC totalSupply |
| GET | `/api/blockchain/token/balance/:address` | — | USDC balance for address |
| GET | `/api/blockchain/rwa/info` | — | TokenableRWA name, symbol, totalMinted |
| GET | `/api/blockchain/rwa/owner/:tokenId` | — | ownerOf(tokenId) |
| GET | `/api/blockchain/rwa/asset/:tokenId` | — | tokenURI → IPFS metadata + resolved imageUrl |
| GET | `/api/blockchain/rwa/token-uri/:tokenId` | — | Raw tokenURI |
| GET | `/api/blockchain/rwa/balance/:address` | — | RWA balance for address |
| GET | `/api/blockchain/rwa/tokens/:address` | — | RWA tokenId list for address |
| POST | `/api/blockchain/rwa/metadata/batch` | — | Batch tokenIds → metadata + imageUrl |
| POST | `/api/blockchain/media/resolve` | — | Resolve ipfs:// URIs to https URLs |
| POST | `/api/psa/analyze` | — | Multipart slab OCR → PSA Public API |
| POST | `/api/psa/analyze-by-cert` | — | JSON `{ certNumber }` → PSA Public API |
| POST | `/api/marketplace/orders` | — | Register Seaport order |
| POST | `/api/marketplace/orders/replace-listing` | — | Cancel old ask + insert new one atomically |
| POST | `/api/marketplace/orders/batch-by-token` | — | Batch order history by tokenIds |
| GET | `/api/marketplace/orders` | — | Active asks (lightweight rows) |
| GET | `/api/marketplace/orders/token/:tokenId` | — | Orders for token (`?activeOnly=true`) |
| GET | `/api/marketplace/orders/:hash` | — | Single order by Seaport hash |
| PATCH | `/api/marketplace/orders/:hash/cancel` | — | Cancel order (`?callerAddress=`) |
| PATCH | `/api/marketplace/orders/:hash/fulfill` | — | Mark single order fulfilled |
| POST | `/api/marketplace/orders/fulfill-matched-pair` | — | Mark matched ask + criteria bid fulfilled |
| GET | `/api/marketplace/collections` | — | Collection list (cursor pagination) |
| POST | `/api/marketplace/collections/market-snapshots` | — | Batch collection list snapshots |
| GET | `/api/marketplace/collections/:key` | — | Collection detail + order book |
| GET | `/api/marketplace/collections/:key/cardhedger` | — | Cardhedger matched card + PSA10 bands |
| GET | `/api/marketplace/collections/:key/cardhedger/price-history` | — | PSA10 price history (`?period`, `?maxDays`) |
| GET | `/api/marketplace/collections/:key/ai-insight` | — | Cardhedger AI market brief |
| GET | `/api/marketplace/collections/:key/market-series` | — | Platform + external time-series chart bundle |
| GET | `/api/marketplace/collections/:key/platform-trades` | — | Fulfilled listings for collection |
| GET | `/api/marketplace/collections/:key/stats` | — | Pool stats (floor, median, volatility) |
| GET | `/api/marketplace/collections/:key/merkle-set` | — | Merkle-eligible tokenIds for collection |
| POST | `/api/marketplace/cardhedger/mint-previews` | — | Batch tokenIds → Cardhedger PSA10 band (max 32) |
| GET | `/api/marketplace/my-assets/hidden` | — | Hidden tokenIds (`?walletAddress=` required) |
| POST | `/api/marketplace/my-assets/hidden` | — | Hide token from portfolio |
| PATCH | `/api/marketplace/my-assets/hidden` | — | Unhide token |
| GET | `/api/marketplace/bids` | — | Active bids for collection (`?collectionKey=`, `?tokenId=`) |
| GET | `/api/marketplace/bids/:id` | — | Bid detail (UUID) with rule JSON |
| POST | `/api/marketplace/trade/match` | — | Reserve match → 202 (`Idempotency-Key` header) |
| GET | `/api/marketplace/trade/executions/:id` | — | Poll settlement state |
| GET | `/api/cardhedger/catalog` | — | Cardhedger operation list |
| GET | `/api/cardhedger/indexes` | — | Dashboard market indexes (Pokemon/MLB/NFL/NBA) |
| POST | `/api/cardhedger/v1/cards/card-search` | — | Card search |
| POST | `/api/cardhedger/v1/cards/card-match` | — | AI card match |
| POST | `/api/cardhedger/v1/cards/set-search` | — | Set search |
| POST | `/api/cardhedger/v1/cards/search-cards-wsort` | — | Card search with sort |
| POST | `/api/cardhedger/v1/cards/card-details` | — | Card details by ID |
| POST | `/api/cardhedger/v1/cards/card-request` | — | Request card data (commercial) |
| POST | `/api/cardhedger/v1/cards/price-estimate` | — | Single price estimate |
| POST | `/api/cardhedger/v1/cards/batch-price-estimate` | — | Batch price estimate |
| POST | `/api/cardhedger/v1/cards/prices-by-card` | — | Prices by card ID |
| POST | `/api/cardhedger/v1/cards/prices-by-cert` | — | Prices by cert number |
| POST | `/api/cardhedger/v1/cards/batch-prices-by-cert` | — | Batch prices by cert |
| POST | `/api/cardhedger/v1/cards/details-by-certs` | — | Batch details by cert |
| POST | `/api/cardhedger/v1/cards/all-prices-by-card` | — | All latest prices by card |
| POST | `/api/cardhedger/v1/cards/comps` | — | Comparable sales (COMPS) |
| GET | `/api/cardhedger/v1/cards/top-movers` | — | Top movers (`?count=`, `?category=`) |
| POST | `/api/cardhedger/v1/cards/90day-prices-by-grade` | — | 90-day prices by grade |
| POST | `/api/cardhedger/v1/cards/90day-prices-by-grade-search` | — | 90-day prices by grade + search |
| POST | `/api/cardhedger/v1/cards/additions-summary` | — | Additions summary |
| POST | `/api/cardhedger/v1/cards/price-updates` | — | Price delta poll |
| POST | `/api/cardhedger/v1/cards/subscribe-price-updates` | — | Subscribe to price updates |
| POST | `/api/cardhedger/v1/cards/sales-stats-by-player` | — | Sales stats by player |
| POST | `/api/cardhedger/v1/cards/total-sales-by-player` | — | Total sales by player |
| POST | `/api/cardhedger/v1/cards/image-search` | — | Image-based card search |
| POST | `/api/cardhedger/v1/cards/details-by-cert-ocr` | — | Graded card image → details |
| POST | `/api/cardhedger/v1/cards/prices-by-cert-ocr` | — | Graded card image → prices |
| GET | `/api/cardhedger/v1/cards/issues` | — | Issues list (`?status=`) |
| POST | `/api/cardhedger/v1/cards/issues` | — | Submit data issue |
| GET | `/api/cardhedger/v1/cards/issues/:issue_id` | — | Single issue |
| GET | `/api/cardhedger/v1/download/daily-price-export/:file_date` | — | Daily price export (`YYYY-MM-DD`) |

---

For per-endpoint request/response schemas, see the **[Swagger UI](http://localhost:4000/api/docs)** or individual reference pages in this section.
