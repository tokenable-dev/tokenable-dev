# Marketplace API

**Controllers:**
- `marketplace/orders/orders.controller.ts`
- `marketplace/collections/collections.controller.ts`
- `marketplace/collections/cert-market-trace.controller.ts`

**Base path:** `/api/marketplace`  
**Swagger tag:** `marketplace`

Trading is **Seaport-centric**: off-chain signed orders in `orders`, fulfillment via wallet. Collection **pricing reads** come from `collection_market_snapshots` (materialized Cardhedger) — see [materialized-market-snapshots.md](../architecture/materialized-market-snapshots.md).

Legacy relational matching (`bids`/`asks` tables, settlement workers) and **hidden-asset** routes are **removed**.

See [architecture/database.md](../architecture/database.md) for current DB tables.

---

## Cert → PSA → Cardhedger trace (debug)

### `POST /api/marketplace/cert-market-trace`

**Swagger tag:** `marketplace`

Cert 번호만 넣어 **PSA 공식 조회(`analyze-by-cert`와 동일)** + **Cardhedger 프리뷰·가격 히스토리**를 한 번에 받습니다. 합성 컬렉션 `components`는 민트 메타와 맞춰 **PSA Variety → `psaVariety`** 등을 채워 Base vs Silver(병행) 구분에 쓰입니다.

**Body:** `CertMarketTraceDto`

| Field | Description |
|-------|-------------|
| `certNumber` | Cert 숫자 또는 `psacard.com/cert/…` URL (필수) |
| `historyMaxCalendarDays` | 히스토리 윈도우 1–365 (기본 90) |
| `scrapePsaSpecImage` | `specId`가 있을 때 Playwright로 spec 이미지 URL 스크랩 (기본 true) |

**Env:** `CARDHEDGER_API_KEY` 필수, **`PSA_PUBLIC_API_TOKEN`** 권장 (PSACert Variety 등).

**응답 요약:** `meta` · `psaAnalyze` · `syntheticCollection` · `collectionQuery` · `cardhedger.preview` / `cardhedger.history` / `cardhedger.comps`(경매 raw+headline) / `cardhedger.mergedChartPoints`(일별+comps 병합, `historyMaxCalendarDays` 클립).

자세한 맥락: [cardhedger-psa-variety.md](../guides/cardhedger-psa-variety.md).

```json
{
  "certNumber": "89531714",
  "historyMaxCalendarDays": 90,
  "scrapePsaSpecImage": true
}
```

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

---

### `GET /api/marketplace/collections/:key/cardhedger/price-history`

Returns PSA10 price history from the materialized snapshot (`external_usd_json`). No Cardhedger upstream on the hot path.

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

### `POST /api/marketplace/collections/token-collection-keys`

Resolves `collection_key` per token ID for Portfolio grouping. **Read-only** — does not create `marketplace_collections` rows (unlike listing flow).

**Body:** `TokenCollectionKeysDto` — `tokenIds` array (max **80** per request).

---

### `GET /api/marketplace/portfolio/daily/:wallet`

Daily portfolio value history for charts. Rows are written by the **09:00 KST cron** (`portfolio_daily_snapshots`). Read path backfills **only** if today's slot row is missing (does not overwrite existing cron rows).

| Query | Description |
|-------|-------------|
| `limit` | Max rows (default 32, min 2, max 120) |

**Response:** `{ items: [{ walletAddress, snapshotDateKst, snapshotAt, totalValueUsd, cardCount }], latest24h: { pnlUsd, pnlPct } }`

Cron captures **all on-chain RWA holders** plus linked / historical wallets with zero holdings. See [database.md](../architecture/database.md#portfolio_daily_snapshots).

---

## ~~My Assets (Hidden Tokens) — removed~~

`GET/POST/PATCH /api/marketplace/my-assets/hidden` and the `hidden_assets` table are **no longer in this repository**. Portfolio lists on-chain RWA balances only.

---

> **Note:** The following section documented a **removed** relational HTTP API. It is kept only for archive search; these routes **do not exist** in the current backend.

## ~~Relational Trading Layer (removed)~~

The former `GET /api/marketplace/bids`, `POST /api/marketplace/trade/match`, and related settlement-worker tables are **not** in the repository anymore. Use **Seaport** orders and on-chain fulfillment only.

---
