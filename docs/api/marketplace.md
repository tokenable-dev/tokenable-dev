# Marketplace API

**Controllers:**
- `marketplace/orders/orders.controller.ts`
- `marketplace/collections/collections.controller.ts`
- `marketplace/snapshots/collection-market-snapshot.controller.ts` — `GET …/cardhedger`, `GET …/cardhedger/price-history`
- `marketplace/portfolio/portfolio.controller.ts` — daily snapshots + hidden holdings
- `marketplace/watchlist/watchlist.controller.ts` — saved collections (JWT)
- `marketplace/collections/rwa-token-admin.controller.ts` — `/api/marketplace/admin/rwa-tokens`
- `marketplace/admin/marketplace-admin-auth.controller.ts` — admin console session
- `marketplace/admin/platform-analytics.controller.ts` — platform KPI dashboard
- `marketplace/admin/user-admin.controller.ts` — user support API

Admin console overview: [guides/marketplace-admin.md](../guides/marketplace-admin.md).

**Base paths:** `/api/marketplace`, `/api/marketplace/watchlist`, `/api/marketplace/admin/*`  
**Swagger tag:** `marketplace`

Trading is **Seaport-centric**: off-chain signed orders in `orders`, fulfillment via wallet. Collection **pricing reads** come from `collection_market_snapshots` (materialized Cardhedger) — see [materialized-market-snapshots.md](../architecture/materialized-market-snapshots.md).

Legacy relational matching (`bids`/`asks` tables, settlement workers) is **removed**. The old `hidden_assets` table was replaced by **`portfolio_holdings`** (off-chain hide + cost basis).

See [architecture/database.md](../architecture/database.md) for current DB tables.

---

## Seaport Orders

### `POST /api/marketplace/orders`

Register a Seaport order (ask or card-level bid/offer) off-chain.

**Body:** `CreateOrderDto` — full Seaport parameters + signature.

```json
{
  "side": "ask",
  "tokenContract": "0x...",
  "tokenId": "123",
  "considerationToken": "0x...",
  "considerationAmount": "150000000",
  "parameters": { ... },
  "signature": "0x..."
}
```

For card offers (bids): `side: "bid"`, real `tokenId`, `collectionKey`, offer itemType `1` (USDC), consideration itemType `2` (ERC721 for that token). Max **3 active bids per wallet per tokenId**. Collection criteria bids (itemType `4`) are rejected.

---

### `POST /api/marketplace/orders/replace-listing`

Cancels the existing active ask for a token and inserts a new one atomically (single DB transaction). Keeps the Merkle token set stable.

**Body:** `ReplaceListingDto`

```json
{
  "oldOrderHash": "0x...",
  "callerAddress": "0x...",
  "order": { ... }
}
```

---

### `POST /api/marketplace/orders/batch-by-token`

Returns order history maps for multiple token IDs in one DB round-trip.

**Body:** `OrdersBatchByTokenDto`

```json
{ "tokenIds": [1, 2, 123] }
```

---

### `GET /api/marketplace/orders`

Returns active asks as lightweight rows (no Seaport `parameters` or `signature`).

---

### `GET /api/marketplace/orders/token/:tokenId`

Returns orders for a token.

| Query | Description |
|-------|-------------|
| `activeOnly=true` | Returns one active ask or `null` (includes parameters for fulfill UI) |

---

### `GET /api/marketplace/orders/:hash`

Returns single order by Seaport hash (full row including parameters and signature).

---

### `PATCH /api/marketplace/orders/:hash/cancel`

Cancels an order. Caller must be the offerer.

| Query | Required | Description |
|-------|----------|-------------|
| `callerAddress` | Yes | Must match order `offerer` |

---

### `PATCH /api/marketplace/orders/:hash/invalidate-dead-bid`

Marks an **active token bid** cancelled when it is proven dead on-chain (buyer USDC balance/allowance below the offer amount, or past Seaport `endTime`). Used by accept-offer preflight / failed settle so other sellers do not retry the same dead offer. **Idempotent** by `order_hash` (already non-active → returns the row). Funded + in-window bids are rejected with 400.

| Query | Required | Description |
|-------|----------|-------------|
| `callerAddress` | Yes | Wallet that reported / attempted accept (audit trail) |

See [seaport-accept-offer.md](../architecture/seaport-accept-offer.md).

---

### `GET /api/marketplace/notifications`

JWT required. Lists inbox items for **all wallets linked to the user**.

Today’s events (ask offerer on the same `tokenId` only):

- **Token bid placed** → `New offer on your listing` with `href` → Portfolio accept-offer deep link (`/portfolio?acceptBid=&tokenId=&askHash=`) and `ctaLabel` → `Accept offer`
- **Token bid cancelled** → `Offer cancelled` (no accept CTA)

**Response:** `{ items: NotificationListItem[] }`

---

### `PATCH /api/marketplace/notifications/read-all`

JWT required. Marks all of the user’s notifications as read.

---

### `PATCH /api/marketplace/notifications/:id/read`

JWT required. Marks one notification read (must belong to a linked wallet).

---

### `PATCH /api/marketplace/orders/:hash/fulfill`

Marks a single order fulfilled (e.g. after `fulfillOrder` on-chain).

| Query | Required | Description |
|-------|----------|-------------|
| `buyerAddress` | Recommended (ask fills) | Buyer wallet — seeds `marketplace_buy` cost basis from listing USDC price |

---

### `POST /api/marketplace/orders/fulfill-matched-pair`

Marks both the ask and the bid fulfilled after `matchAdvancedOrders` (token offer or legacy criteria). Buyer cost basis is seeded from the ask fill price (`bid.offerer` wallet, `source = marketplace_buy`).

Seller **accept-offer** (keep ask price; do not lower-to-match) is specified in [seaport-accept-offer.md](../architecture/seaport-accept-offer.md). Deep link: `/portfolio?acceptBid=&tokenId=` (+ optional `askHash`). RQ: `invalidateAfterAcceptOffer` / `invalidateAfterDeadBid`.

**Body:** `FulfillMatchedPairDto`

```json
{ "askOrderHash": "0x...", "bidOrderHash": "0x..." }
```

---

## Collections

### `GET /api/marketplace/collections`

Returns a cursor-paginated list of collection summaries.

| Query | Default | Description |
|-------|---------|-------------|
| `limit` | `30` | Max `60` |
| `cursor` | — | Opaque cursor from prior page `nextCursor` |

---

### `POST /api/marketplace/collections/market-snapshots`

Batch fetches list-row snapshots from **materialized** `collection_market_snapshots` (stale-while-revalidate). Does not call Cardhedger on every request.

**Body:** `BatchMarketSnapshotsDto`

```json
{
  "collectionKeys": ["ab5f1f...", "22028c..."],
  "priceHistoryDuration": "90d"
}
```

---

### `GET /api/marketplace/collections/:key`

Returns collection detail + active listings + collection bids + representative image URL.

When no `marketplace_collections` row exists yet, `collection: null` is returned (no 404) to support client prefetch.

```json
{
  "collection": { ... } | null,
  "listings": [...],
  "collectionBids": [...],
  "representativeImageUrl": "https://..."
}
```

---

### `GET /api/marketplace/collections/:key/cardhedger`

Returns the Cardhedger-matched catalog card and PSA10 spot price bands for this collection.

> **Controller:** `CollectionMarketSnapshotController`.

---

### `GET /api/marketplace/collections/:key/cardhedger/price-history`

Returns PSA10 price history from the materialized snapshot (`external_usd_json`). No Cardhedger upstream on the hot path.

> **Controller:** `CollectionMarketSnapshotController`.

| Query | Values | Default |
|-------|--------|---------|
| `period` | `7d`, `30d`, `90d`, `1y` | `90d` |
| `maxDays` | `1`–`365` | Derived from `period` |

---

### `GET /api/marketplace/collections/:key/ai-insight`

Returns a Cardhedger AI market brief for the collection (card-match powered).

---

### `GET /api/marketplace/collections/:key/market-series`

Returns a chart bundle: platform fills (USDC) + Cardhedger reference prices + window % change.

| Query | Values | Default |
|-------|--------|---------|
| `priceHistoryDuration` | `7d`, `30d`, `90d`, `180d`, `365d` | `365d` |

---

### `GET /api/marketplace/collections/:key/platform-trades`

Returns platform fulfilled listings (chart `platformUsd`) plus a merged trades tape: Tokenable fills + Cardhedger comps raw (max **100** individual sales). `volume.windows` sums comps + platform fills per calendar window.

---

### `GET /api/marketplace/collections/:key/stats`

Returns pool statistics:
- Floor = 10th percentile on Tukey IQR-trimmed active asks
- Median and band on trimmed set
- Volatility = sample stdev
- `isReliable: false` when `sampleSize < 5`

---

### `GET /api/marketplace/collections/:key/merkle-set`

Returns all tokenIds eligible for the Merkle tree (all minted RWAs in this collection, not just active asks).

| Query | Description |
|-------|-------------|
| `bypassCache=true` | Skip cache and recompute |

---

### `POST /api/marketplace/cardhedger/mint-previews`

Resolves Cardhedger PSA10 references for owned token IDs. Used by the Portfolio page.

**Body:** `MintPreviewsByTokenIdsDto`

```json
{ "tokenIds": [101, 102, 103] }
```

Max 32 token IDs per request.

---

### `POST /api/marketplace/collections/portfolio-market-batch`

Batch pool stats + `market-series` bundle per collection key (max 60 keys). Used by Portfolio for owned tokens mapped to buckets.

**Body:** `PortfolioMarketBatchDto`

```json
{
  "collectionKeys": ["22028c12…"],
  "priceHistoryDuration": "365d"
}
```

---

### `POST /api/marketplace/collections/on-mint`

Called by the vault mint flow immediately after the on-chain `Minted` event is confirmed. **Awaits** marketplace bootstrap so listing price suggestions have comps before the first ask.

**Body**

```json
{ "tokenId": 42 }
```

**Response**

```json
{
  "accepted": true,
  "collectionKey": "22028c12…",
  "bootstrapped": true
}
```

| Field | Meaning |
|-------|---------|
| `collectionKey` | Lowercase bucket key when `ensureCollectionForListing` succeeded |
| `bootstrapped` | `true` when a `marketplace_collections` row exists for this mint |

Server work (same as `MintEventListenerService.handleMintedToken`): UPSERT collection + `rwa_tokens`, Cardhedger cert → `cardhedgerCardId`, snapshot enqueue, collection cover set on first bucket create and upgraded later when a higher-scoring catalog URL is resolved. The frontend retries up to 5 times on transient failure and prefetches `platform-trades` + snapshots into React Query.

Also fired by optional on-chain listener when `MINT_EVENT_LISTENER_ENABLED=1` (idempotent with this POST).

---

### `POST /api/marketplace/collections/token-collection-keys`

Resolves `collection_key` per token ID for Portfolio grouping. **Read-only** — does not create `marketplace_collections` rows (unlike listing flow).

**Body:** `TokenCollectionKeysDto` — `tokenIds` array (max **80** per request).

---

### `GET /api/marketplace/portfolio/daily/:wallet`

Daily portfolio value history for charts. Rows are written by the **09:00 KST cron** (`portfolio_daily_snapshots`) **per chain**. Read path backfills **only** if today's slot row is missing for the request chain (does not overwrite existing cron rows).

Requires `x-tokenable-chain-id` (falls back to `DEFAULT_CHAIN_ID`).

| Query | Description |
|-------|-------------|
| `limit` | Max rows (default 32, min 2, max 120) |

**Response:** `{ chainId, items: [{ walletAddress, chainId, snapshotDateKst, snapshotAt, totalValueUsd, cardCount }], latest24h: { pnlUsd, pnlPct } }`

Cron captures **all on-chain RWA holders on each configured chain** plus linked / historical wallets with zero holdings. See [database.md](../architecture/database.md#portfolio_daily_snapshots).

---

## Portfolio holdings (hide + cost basis)

Off-chain prefs — NFT remains in the wallet. `hidden_at` excludes a token from portfolio totals. `cost_basis_usd` powers P/L; `manual` edits are never overwritten by auto seed.

### `GET /api/marketplace/portfolio/hidden/:wallet`

Returns `{ tokenIds: number[] }` (rows with `hidden_at` set).

### `POST /api/marketplace/portfolio/hidden`

**Body:** `{ walletAddress, tokenId }` — hide one holding.

### `DELETE /api/marketplace/portfolio/hidden`

**Body:** `{ walletAddress, tokenId }` — restore one holding.

### `POST /api/marketplace/portfolio/holdings/batch`

**Body:** `{ walletAddress, tokenIds }` (max 500).

**Response:** `{ items: [{ tokenId, hidden, costBasisUsd, costBasisSource, acquiredAt }] }`

`costBasisSource`: `manual` | `vault_delivery` | `marketplace_buy` | null.

### `PUT /api/marketplace/portfolio/holdings/cost-basis`

**Body:** `{ walletAddress, tokenId, costBasisUsd }` — user manual edit (`source = manual`).

**Vault deliver seed:** when admin delivers a custody NFT (`deliverCustodyNftToUser`), the backend seeds `vault_delivery` cost basis from the current market mark USD at deliver time. Manual rows are skipped.

**Marketplace buy seed:** after ask fulfill (`PATCH …/fulfill?buyerAddress=`) or matched-pair fulfill, the backend seeds `marketplace_buy` from the ask USDC price for the buyer wallet. Manual rows are skipped.

**Portfolio totals:** `portfolio_daily_snapshots` (09:00 KST cron + read-path backfill) drives **Portfolio value** and **24h P/L** in the hero/chart. Per-row **My Assets P/L** uses `portfolio_holdings` cost basis vs live mark.

---

## ~~My Assets (Hidden Tokens) — legacy~~

The former `hidden_assets` table and `GET/POST/PATCH /api/marketplace/my-assets/hidden` routes are **gone**. Use **`portfolio/hidden`** above.

---

> **Note:** The following section documented a **removed** relational HTTP API. It is kept only for archive search; these routes **do not exist** in the current backend.

## ~~Relational Trading Layer (removed)~~

The former `GET /api/marketplace/bids`, `POST /api/marketplace/trade/match`, and related settlement-worker tables are **not** in the repository anymore. Use **Seaport** orders and on-chain fulfillment only.

---
