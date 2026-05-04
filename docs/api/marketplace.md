# Marketplace API

**Controllers:**
- `marketplace/orders/orders.controller.ts`
- `marketplace/collections/collections.controller.ts`
- `marketplace/assets/assets.controller.ts`
- `marketplace/trading/bids.controller.ts`
- `marketplace/trading/trade.controller.ts`

**Base path:** `/api/marketplace`  
**Swagger tag:** `marketplace`

The marketplace is built on two parallel axes:

| Axis | Description |
|------|-------------|
| **Seaport** | Off-chain signed orders, fulfilled on-chain via `fulfillOrder` / `matchAdvancedOrders` |
| **Relational** | Rule-based conditional bids/asks, server-side settlement worker |

See [architecture/database.md](../architecture/database.md) for DB schema details.

---

## Seaport Orders

### `POST /api/marketplace/orders`

Register a Seaport order (ask or criteria bid) off-chain.

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

For criteria bids: `side: "bid"`, `tokenId: "0"`, `collectionKey: "..."`, item type `4` in `consideration`.

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

### `PATCH /api/marketplace/orders/:hash/fulfill`

Marks a single order fulfilled (e.g. after `fulfillOrder` on-chain).

---

### `POST /api/marketplace/orders/fulfill-matched-pair`

Marks both the ask and the criteria bid fulfilled after `matchAdvancedOrders`.

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

Batch fetches list-row snapshots for multiple collections: Cardhedger PSA10 grade strip, category, external sparkline, optional market stats.

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

---

### `GET /api/marketplace/collections/:key/cardhedger/price-history`

Returns Cardhedger PSA10 price history for the matched card.

| Query | Values | Default |
|-------|--------|---------|
| `period` | `7d`, `30d`, `90d`, `1y`, `all` | `90d` |
| `maxDays` | `1`–`4000` | Derived from `period` |

---

### `GET /api/marketplace/collections/:key/ai-insight`

Returns a Cardhedger AI market brief for the collection (card-match powered).

---

### `GET /api/marketplace/collections/:key/market-series`

Returns a chart bundle: platform fills (USDC) + Cardhedger reference prices + window % change.

| Query | Values | Default |
|-------|--------|---------|
| `priceHistoryDuration` | `7d`, `30d`, `90d`, `180d`, `365d` | `365d` |
| `hintTokenId` | tokenId string | — |

---

### `GET /api/marketplace/collections/:key/platform-trades`

Returns fulfilled listings for this collection (chart data points + trade tape rows).

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

## My Assets (Hidden Tokens)

### `GET /api/marketplace/my-assets/hidden`

Returns hidden tokenIds for a wallet.

| Query | Required |
|-------|----------|
| `walletAddress` | Yes |

```json
{ "tokenIds": [5, 12] }
```

---

### `POST /api/marketplace/my-assets/hidden`

Hides a token from the portfolio view.

```json
{ "walletAddress": "0x...", "tokenId": 5 }
```

---

### `PATCH /api/marketplace/my-assets/hidden`

Unhides a token.

| Query | Required |
|-------|----------|
| `walletAddress` | Yes |
| `tokenId` | Yes |

---

## Relational Trading Layer (Bids / Trade)

The relational layer runs alongside Seaport. See [architecture/database.md](../architecture/database.md) for the settlement state machine.

### `GET /api/marketplace/bids`

Returns active bids for a collection. If `tokenId` is provided, also evaluates rule applicability.

| Query | Required |
|-------|----------|
| `collectionKey` | Yes |
| `tokenId` | No |

---

### `GET /api/marketplace/bids/:id`

Returns bid detail including the full rule JSON.

| Param | Type |
|-------|------|
| `id` | UUID |

---

### `POST /api/marketplace/trade/match`

Reserves a match. Creates a `pending` `trade_execution` and locks the ask. Settlement worker completes the execution asynchronously.

**Returns:** `202 Accepted`

**Header:** `Idempotency-Key` (recommended — prevents duplicate executions on retry)

**Body:** `TradeMatchDto`

```json
{ "bidId": "uuid", "askId": "uuid", "tokenId": "123" }
```

**Response:** `MatchAcceptedResponseDto`

```json
{ "executionId": "uuid", "status": "pending" }
```

---

### `GET /api/marketplace/trade/executions/:id`

Polls settlement state for a trade execution.

| Param | Type |
|-------|------|
| `id` | UUID |

**Response:**

```json
{
  "id": "uuid",
  "execution_state": "pending | locked | executed | failed",
  "bid_id": "uuid",
  "ask_id": "uuid",
  "token_id": "123"
}
```
