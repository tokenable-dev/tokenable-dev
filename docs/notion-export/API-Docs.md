# API Docs

**Prefix:** `/api` · **Swagger:** `GET /api/docs` · **Local:** `http://localhost:4100/api`

**Full docs:** [github.com/tokenable-dev/tokenable-dev/tree/develop/docs/api](https://github.com/tokenable-dev/tokenable-dev/tree/develop/docs/api)

| Auth | Meaning |
|------|---------|
| — | Public |
| JWT | Cookie `access_token` or `Authorization: Bearer` |
| Admin | Marketplace admin session |
| $ | `?adminWallet=` in `MARKETPLACE_ADMIN_WALLETS` |

Optional staging gate: `SITE_ACCESS_ENABLED` → [site-access.md](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/api/site-access.md)

---

## Auth `/api/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Email signup (verify before login) |
| POST | `/auth/login` | — | Email login → JWT cookie |
| GET | `/auth/google` | — | OAuth redirect |
| GET | `/auth/google/callback` | — | OAuth callback → JWT |
| GET | `/auth/verify-email` | — | `?token=` email verify |
| POST | `/auth/send-verification-email` | JWT | Resend verify |
| POST | `/auth/resend-verification-email` | — | Resend by email |
| POST | `/auth/forgot-password` | — | Reset email |
| POST | `/auth/reset-password` | — | `{ token, password }` |
| POST | `/auth/change-password` | JWT | Change password |
| POST | `/auth/delete-account` | JWT | Delete account |
| GET | `/auth/session` | — | `{ user }` or `{ user: null }` |
| POST | `/auth/logout` | — | Clear cookie |
| GET | `/auth/wallet/challenge` | JWT | Sign challenge |
| POST | `/auth/wallet` | JWT | Link wallet |
| DELETE | `/auth/wallet` | JWT | Unlink wallet |

→ [api/auth.md](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/api/auth.md)

---

## RWA `/api/rwa`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/rwa/upload` | — | Multipart → IPFS (**PSA 10** required) |

→ [api/rwa.md](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/api/rwa.md)

---

## Blockchain `/api/blockchain`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/blockchain/rwa/asset/:tokenId` | — | Metadata + imageUrl |
| GET | `/blockchain/rwa/token-uri/:tokenId` | — | Raw tokenURI |
| GET | `/blockchain/rwa/tokens/:address` | — | Owned tokenIds |
| POST | `/blockchain/rwa/metadata/batch` | — | `{ tokenIds[] }` |
| POST | `/blockchain/media/resolve` | — | `ipfs://` → https |

→ [api/blockchain.md](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/api/blockchain.md)

---

## PSA `/api/psa`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/psa/analyze` | — | Multipart slab OCR |
| POST | `/psa/analyze-by-cert` | — | `{ certNumber }` |
| GET | `/psa/order/progress/:orderNumber` | — | PSA order proxy |
| GET | `/psa/order/submission-progress/:submissionNumber` | — | PSA submission proxy |
| POST | `/psa/order/progress` | — | Batch order progress |
| POST | `/psa/order/submission-progress` | — | Batch submission progress |

→ [api/psa.md](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/api/psa.md)

---

## Marketplace — Orders `/api/marketplace`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/marketplace/orders` | — | Register Seaport order |
| POST | `/marketplace/orders/replace-listing` | — | Cancel ask + new ask |
| POST | `/marketplace/orders/replace-bid` | — | Replace criteria bid |
| POST | `/marketplace/orders/batch-by-token` | — | `{ tokenIds[] }` history |
| GET | `/marketplace/orders/by-offerer` | — | `?offerer=` |
| GET | `/marketplace/orders` | — | Active asks (light) |
| GET | `/marketplace/orders/token/:tokenId` | — | `?activeOnly=true` |
| GET | `/marketplace/orders/:hash` | — | Full order |
| PATCH | `/marketplace/orders/:hash/cancel` | — | `?callerAddress=` |
| PATCH | `/marketplace/orders/:hash/fulfill` | — | Mark fulfilled |
| POST | `/marketplace/orders/fulfill-matched-pair` | — | Ask + bid fulfilled |

---

## Marketplace — Collections `/api/marketplace`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/marketplace/collections` | — | List `?limit&cursor` |
| POST | `/marketplace/collections/market-snapshots` | — | Batch DB snapshots |
| POST | `/marketplace/collections/portfolio-market-batch` | — | Portfolio stats (≤60 keys) |
| POST | `/marketplace/collections/on-mint` | — | `{ tokenId }` post-mint bootstrap |
| POST | `/marketplace/collections/token-collection-keys` | — | TokenIds → keys (≤80) |
| POST | `/marketplace/cardhedger/mint-previews` | — | PSA10 bands (≤32 tokens) |
| POST | `/marketplace/cert-market-trace` | — | Debug cert → PSA → Cardhedger |
| GET | `/marketplace/collections/:key` | — | Detail + listings |
| GET | `/marketplace/collections/:key/cardhedger` | — | Matched card + bands |
| GET | `/marketplace/collections/:key/cardhedger/price-history` | — | `?period&maxDays` |
| GET | `/marketplace/collections/:key/ai-insight` | — | AI market brief |
| GET | `/marketplace/collections/:key/market-series` | — | Chart bundle |
| GET | `/marketplace/collections/:key/platform-trades` | — | Fulfilled tape |
| GET | `/marketplace/collections/:key/stats` | — | Floor, median, vol |
| GET | `/marketplace/collections/:key/grade-catalog` | — | Grade catalog |
| GET | `/marketplace/collections/:key/grade-series` | — | Grade series |
| GET | `/marketplace/collections/:key/merkle-set` | — | Criteria-bid token set |
| GET | `/marketplace/rwa/:tokenId/trades` | — | Token trades |
| POST | `/marketplace/collections/:key/admin/cover` | $ | Set cover |
| POST | `/marketplace/collections/:key/admin/cover/from-token` | $ | Cover from token |
| POST | `/marketplace/collections/:key/admin/delete` | $ | Delete collection |

→ [api/marketplace.md](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/api/marketplace.md)

---

## Marketplace — Portfolio & Watchlist

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/marketplace/portfolio/daily/:wallet` | — | Daily snapshots `?limit` |
| GET | `/marketplace/portfolio/hidden/:wallet` | — | Hidden tokenIds |
| POST | `/marketplace/portfolio/hidden` | — | Hide `{ walletAddress, tokenId }` |
| DELETE | `/marketplace/portfolio/hidden` | — | Unhide |
| GET | `/marketplace/watchlist` | JWT | List saved collections |
| POST | `/marketplace/watchlist` | JWT | Add `{ collectionKey }` |
| DELETE | `/marketplace/watchlist` | JWT | Remove `{ collectionKey }` |

---

## Marketplace Admin `/api/marketplace/admin`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/marketplace/admin/auth/session` | Admin | Session |
| POST | `/marketplace/admin/auth/login` | — | Admin login |
| POST | `/marketplace/admin/auth/logout` | Admin | Logout |
| GET | `/marketplace/admin/rwa-tokens/listings` | Admin | Token admin list |
| PATCH | `/marketplace/admin/rwa-tokens/:tokenId` | Admin | Update metadata |
| POST | `/marketplace/admin/rwa-tokens/:tokenId/preview-metadata-image` | Admin | Preview image fix |

---

## Cardhedger `/api/cardhedger`

### Top 100 & Top Movers

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/cardhedger/top100/categories` | — | Categories |
| GET | `/cardhedger/top100/:category` | — | Today's rank |
| GET | `/cardhedger/top100/:category/history` | — | History dates |
| POST | `/cardhedger/top100/:category/refresh` | $ | Force refresh |
| POST | `/cardhedger/top100/refresh-all` | $ | Refresh all |
| POST | `/cardhedger/top100/discover-categories` | $ | Discover categories |
| GET | `/cardhedger/top-movers` | — | `?count&category` |
| POST | `/cardhedger/top-movers/refresh` | $ | Invalidate cache |
| GET | `/cardhedger/routes` | — | Proxy path manifest |

### Upstream proxy `/api/cardhedger/v1/*`

Server injects `CARDHEDGER_API_KEY`. OpenAPI mirror: [backend/src/api-1.json](https://github.com/tokenable-dev/tokenable-dev/blob/develop/backend/src/api-1.json)

| Method | Path |
|--------|------|
| GET | `/v1/cards/top-movers` |
| POST | `/v1/cards/card-search` |
| POST | `/v1/cards/card-match` |
| POST | `/v1/cards/set-search` |
| POST | `/v1/cards/search-cards-wsort` |
| POST | `/v1/cards/card-details` |
| POST | `/v1/cards/prices-by-cert` |
| POST | `/v1/cards/batch-prices-by-cert` |
| POST | `/v1/cards/prices-by-cert-ocr` |
| POST | `/v1/cards/details-by-cert-ocr` |
| POST | `/v1/cards/details-by-certs` |
| POST | `/v1/cards/prices-by-card` |
| POST | `/v1/cards/comps` |
| POST | `/v1/cards/all-prices-by-card` |
| POST | `/v1/cards/90day-prices-by-grade` |
| POST | `/v1/cards/card-request` |
| POST | `/v1/cards/price-updates` |
| POST | `/v1/cards/price-estimate` |
| POST | `/v1/cards/batch-price-estimate` |
| POST | `/v1/cards/card-fmv` |
| POST | `/v1/cards/card-fmv-batch` |
| POST | `/v1/cards/fmv-by-cert` |
| POST | `/v1/cards/subscribe-price-updates` |
| POST | `/v1/cards/90day-prices-by-grade-search` |
| POST | `/v1/cards/additions-summary` |
| POST | `/v1/cards/total-sales-by-player` |
| POST | `/v1/cards/sales-stats-by-player` |
| POST | `/v1/cards/image-search` |
| POST | `/v1/cards/image-match` |
| POST | `/v1/cards/issues` |
| GET | `/v1/cards/issues` |
| GET | `/v1/cards/issues/{issue_id}` |
| GET | `/v1/download/daily-price-export/{file_date}` |

→ [api/cardhedger.md](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/api/cardhedger.md)

---

## Cardhedger Ops & Webhooks

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/webhooks/cardhedger/price-updates` | — | Price push webhook |
| GET | `/admin/cardhedger/health` | $ | Integration health |
| GET | `/admin/cardhedger/circuit` | $ | Circuit breaker |
| GET | `/admin/cardhedger/metrics` | $ | JSON metrics |
| GET | `/admin/cardhedger/prometheus` | $ | Prometheus scrape |
| GET | `/admin/cardhedger/price-subscriptions/status` | Admin | Infra status |
| GET | `/admin/cardhedger/price-subscriptions` | Admin | List subscriptions |
| GET | `/admin/cardhedger/price-subscriptions/delta-runs` | Admin | Delta import runs |
| GET | `/admin/cardhedger/price-subscriptions/delta-runs/:id` | Admin | Run detail |
| POST | `/admin/cardhedger/price-subscriptions/sync` | Admin | Sync subscriptions |
| POST | `/admin/cardhedger/price-subscriptions/nightly-delta/run` | Admin | Run delta import |
| POST | `/admin/cardhedger/price-subscriptions/:collectionKey` | Admin | Subscribe |
| DELETE | `/admin/cardhedger/price-subscriptions/:collectionKey` | Admin | Unsubscribe |

---

## Card Ladder `/api/cardladder`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/cardladder/indexes` | — | Landing market indexes |

---

## Misc

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/site-access/verify` | — | Staging gate `{ password }` |
| GET | `/health` | — | Liveness |

---

## Detailed per-route docs

| Area | Link |
|------|------|
| **API index** | [api/README.md](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/api/README.md) |
| Auth | [api/auth.md](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/api/auth.md) |
| RWA | [api/rwa.md](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/api/rwa.md) |
| Blockchain | [api/blockchain.md](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/api/blockchain.md) |
| PSA | [api/psa.md](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/api/psa.md) |
| Marketplace | [api/marketplace.md](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/api/marketplace.md) |
| Cardhedger | [api/cardhedger.md](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/api/cardhedger.md) |
| Site access | [api/site-access.md](https://github.com/tokenable-dev/tokenable-dev/blob/develop/docs/api/site-access.md) |
| **All docs** | [docs/](https://github.com/tokenable-dev/tokenable-dev/tree/develop/docs) |

**Removed (do not call):** `/api/marketplace/bids`, `/api/marketplace/trade/match`
