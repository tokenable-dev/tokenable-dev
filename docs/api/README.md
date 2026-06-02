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
| `marketplace` | `marketplace/collections/cert-market-trace.controller.ts` | `/api/marketplace` |
| `cardhedger` | `cardhedger/controllers/indexes.controller.ts` | `/api/cardhedger` |

`CardhedgerService` also calls Cardhedger upstream from PSA, collections, and indexes code — those paths are **not** duplicated as `/api/cardhedger/v1/*` HTTP routes.

---

## Route Summary

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/api/auth/google` | — | Initiate Google OAuth |
| GET | `/api/auth/google/callback` | — | OAuth callback → JWT cookie → frontend redirect |
| GET | `/api/auth/verify-email` | — | Email verification link (`?token=`) |
| POST | `/api/auth/send-verification-email` | JWT | Resend verification email |
| GET | `/api/auth/session` | — | Current session (200 + `user: null` for unauthenticated) |
| POST | `/api/auth/logout` | — | Clear cookie (204) |
| POST | `/api/auth/wallet` | JWT | Link wallet address to account |
| DELETE | `/api/auth/wallet` | JWT | Unlink wallet address |
| POST | `/api/rwa/upload` | — | Multipart — upload image + metadata to IPFS (Pinata) |
| GET | `/api/blockchain/rwa/asset/:tokenId` | — | tokenURI → IPFS metadata + resolved imageUrl |
| GET | `/api/blockchain/rwa/token-uri/:tokenId` | — | Raw tokenURI |
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
| POST | `/api/marketplace/collections/market-snapshots` | — | Batch list-row snapshots (DB-first) |
| POST | `/api/marketplace/collections/portfolio-market-batch` | — | Portfolio batch stats + market-series |
| POST | `/api/marketplace/collections/token-collection-keys` | — | Batch tokenIds → collection_key (read-only; max 80) |
| GET | `/api/marketplace/portfolio/daily/:wallet` | — | Daily portfolio snapshots + 24h P&L (`?limit=`) |
| POST | `/api/marketplace/cert-market-trace` | — | Debug: cert → PSA → Cardhedger trace |
| GET | `/api/marketplace/collections/:key` | — | Collection detail + order book |
| GET | `/api/marketplace/collections/:key/cardhedger` | — | Cardhedger matched card + PSA10 bands |
| GET | `/api/marketplace/collections/:key/cardhedger/price-history` | — | PSA10 price history (`?period`, `?maxDays`) |
| GET | `/api/marketplace/collections/:key/ai-insight` | — | Cardhedger AI market brief |
| GET | `/api/marketplace/collections/:key/market-series` | — | Platform + external time-series chart bundle |
| GET | `/api/marketplace/collections/:key/platform-trades` | — | Fulfilled listings for collection |
| GET | `/api/marketplace/collections/:key/stats` | — | Pool stats (floor, median, volatility) |
| GET | `/api/marketplace/collections/:key/merkle-set` | — | Merkle-eligible tokenIds for collection |
| POST | `/api/marketplace/collections/:key/admin/cover` | — | Admin: set collection cover URL |
| POST | `/api/marketplace/collections/:key/admin/cover/from-token` | — | Admin: preview cover from token metadata |
| POST | `/api/marketplace/collections/:key/admin/delete` | — | Admin: delete collection + related rows |
| POST | `/api/marketplace/cardhedger/mint-previews` | — | Batch tokenIds → Cardhedger PSA10 band (max 32) |
| GET | `/api/cardhedger/indexes` | — | Dashboard market indexes (Pokemon/MLB/NFL/NBA) |
| GET | `/api/health` | — | Liveness probe |

---

For per-endpoint request/response schemas, see the **[Swagger UI](http://localhost:4000/api/docs)** or individual reference pages in this section.
