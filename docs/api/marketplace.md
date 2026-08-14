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

For card offers (bids): `side: "bid"`, real `tokenId`, `collectionKey`, offer itemType `1` (USDC), consideration itemType `2` (ERC721 for that token). Max **1 active bid per wallet per collection**. Collection criteria bids (itemType `4`) are rejected. Token bids expire after **7 days** (Seaport `endTime`).

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

### `GET /api/marketplace/orders/portfolio-activity`

Portfolio transaction history for a wallet (chain-scoped via `x-tokenable-chain-id`). Returns **fulfilled** orders where the wallet is:

- ask **offerer** (SELL), or
- bid **offerer** (BUY via sell-into-bid), or
- ask `parameters._filledByBuyer` (BUY via take-ask)

| Query | Required | Description |
|-------|----------|-------------|
| `address` | Yes | Wallet |
| `limit` | No | Max rows (default 200, cap 500) |

Sell-into-bid fills persist `_settlementAmount`, `_matchedBidOrderHash`, and `_filledByBuyer` on the ask so the UI shows **one row per settlement** at the price paid.

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

JWT required. Lists inbox items for **all wallets linked to the user** on the **active chain** (`x-tokenable-chain-id`). Sepolia alerts do not appear while the app is on Polygon (and vice versa).

In-app events (Notifications spec **v2 2026-08** — Email/Telegram/Web push delivery TBD; in-app + toast now):

| eventKey | type | Trigger |
|----------|------|---------|
| `SELLER_TOP_BID_UPDATED` | bid | New **highest** token bid on an active ask (Edit price CTA) |
| `SELLER_BID_CANCELLED` / `SELLER_BID_UNFILLED` | bid | Bid withdrawn / dead after fill attempt (ask owner; not in v2 table — kept) |
| `BUYER_BID_PLACED` / `BUYER_BID_EXPIRING` / `BUYER_BID_EXPIRED` | bid | Bidder lifecycle |
| `BUYER_BID_FILLED` / `BUYER_FILL_FAILED` | bid | Bid filled or unfunded at settle |
| `SELLER_SOLD` / `SELLER_PAYOUT_DONE` / `BUYER_VAULT_PURCHASED` / `SELLER_LISTING_LIVE` | trade | Sale settle / self-vault payout / listing live |
| `SELLER_KYC_RESULT` / `SELLER_SUBMISSION_RECEIVED` / `SELLER_VERIFY_DONE_SET_PRICE` / `SELLER_CARD_REJECTED` / `SELLER_LISTING_FAILED` / `SELLER_PRICE_PENDING_REMINDER` | vault | Sell / vault ops |
| `RD_PAID_PREPARING` | vault | Ship-from-vault prepaid confirmed / preparing (`href=/portfolio/redeem?view=…`) |
| `RD_SHIPPED` | vault | Tracking set (`href=/portfolio/redeem?view=transit`, CTA Track) |
| `RD_RECEIVED_REMINDER` | vault | Ask to confirm receipt (emit helper ready; cron TBD) |
| `RD_AUTO_CANCELLED_REFUND` | vault | Cancelled + refunded (admin refund today; auto SLA later) |
| `PARTNER_SHIPMENT_REQUEST` | vault | Self-vault partner must ship (`href=/partner/shipments`) |
| `FUNDS_WITHDRAW_SUBMITTED` / `SENT` / `FAILED` | vault | Bank cash-out helpers ready; domain not wired yet |
| `REDEEM_COMPLETED` | vault | User confirmed receipt (ack; not in v2 table) |

**Legacy aliases** (still resolved for old inbox rows): `WD_REQUEST_RECEIVED`, `WD_SHIPPED`, `REDEEM_PREPARING`, `REDEEM_REFUNDED`, `SELLER_REDEEM_SHIP`.

**Not yet emitted (domain missing):** `SELLER_STRIKE` / `SELLER_SUSPENDED`, `PARTNER_SLA_WARN` / `PARTNER_SLA_BREACH`, admin ops inbox (`ADMIN_*`).

**Client UX:** The notifications drawer and ephemeral **toasts** (`NotificationToastsHost`, `.tk-note`) share the same title/body/`href`/`ctaLabel`. New unread items (after the first fetch seed) surface as toasts; click / CTA uses the same navigation as the drawer (including Add funds → MoonPay).

---

### `PATCH /api/marketplace/notifications/read-all`

JWT required. Marks all of the user’s notifications as read **on the active chain only**.

---

### `PATCH /api/marketplace/notifications/:id/read`

JWT required. Marks one notification read (must belong to a linked wallet).

---

### `GET /api/marketplace/rwa-tokens/:tokenId/settlement-policy`

Returns `{ tokenId, settlementPolicy, vaultLabel }` where `settlementPolicy` is `standard` or `self_vault_hold`.  
`vaultLabel` is `PSA Vault` for standard custody, or `{partner displayName} vault` for Self vault. Used by list-ask builders and portfolio chips.

### `POST /api/marketplace/rwa-tokens/vault-info/batch`

Body `{ tokenIds: string[] }` (max 200) → `{ items: [{ tokenId, settlementPolicy, vaultLabel }] }`.

### `GET /api/marketplace/partners/self-vault-eligibility?wallet=`

Public. Returns whether an active partner wallet may use Self vault:

`{ eligible, isPartner, hasCompanyAddress, partnerId, displayName, vaultLabel }`

`eligible` is true only when the wallet matches an **active** partner **and** a company Origin address exists (`marketplace_partner_addresses`).

### `GET /api/marketplace/partners/me` (JWT)

Partner session for the signed-in user (wallet ∩ partners): `{ isPartner, partnerId, displayName, vaultLabel, hasCompanyAddress, companyAddress }`.

### `GET|PUT /api/marketplace/partners/me/company-address` (JWT)

Get or upsert the partner company / Self-vault Origin address (FedEx Rate ship-from). Country is ISO 3166-1 alpha-2; `region` required for US/CA.

**UX:** Approved partners without an Origin see the designer **shipping-origin** modal (`PartnerCompanyAddressRequiredModal`). **Remind me later** dismisses to a sticky banner; Self vault mint/list stay locked until the address is saved. Backend also rejects `POST /rwa/mint` with `deliveryMode=direct` using `COMPANY_ADDRESS_REQUIRED` (see [rwa.md](./rwa.md)).

### `GET /api/marketplace/partners/me/redeems` (JWT)

List Partner-vault redemptions for the signed-in partner (`vault_partner_id` = me). Same row shape as admin redeems. Frontend: `/partner/shipments`.

### `PATCH /api/marketplace/partners/me/redeems/batches/:batchId/tracking` (JWT)

Set tracking for this partner’s shipment within a payment batch. Body: `{ shipmentKey, trackingNumber, trackingCarrier? }`. `shipmentKey` must be `partner:<me.partnerId>` — writes the same `vault_redemptions` columns as admin tracking.

### Self-vault settlements

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/self-vault-settlements/mine` | JWT | Buyer/seller wallet settlements |
| POST | `/self-vault-settlements/:id/confirm` | JWT | Buyer confirms → `confirmed` |
| GET | `/admin/self-vault-settlements` | Admin | Optional `?status=`; scoped to `x-tokenable-chain-id`. UI: `/marketplace/admin/self-vault-payouts` |
| POST | `/admin/self-vault-settlements/:id/confirm` | Admin | Ops confirm |
| POST | `/admin/self-vault-settlements/:id/reject` | Admin | Reject |
| POST | `/admin/self-vault-settlements/:id/execute-payout` | Admin | Platform fee wallet → seller USDC → `paid` (early; also auto after ~5 min) |

Created automatically when a `self_vault_hold` ask is fulfilled (or matched). Admin can pay early; otherwise cron auto confirm+payout after ~5 minutes. See BR-8c.

### `PATCH /api/marketplace/orders/:hash/fulfill`

Marks a single order fulfilled (e.g. after `fulfillOrder` on-chain). Rejects bid-only fulfill for `self_vault_hold` tokens.

| Query | Required | Description |
|-------|----------|-------------|
| `buyerAddress` | Recommended (ask fills) | Buyer wallet — seeds `marketplace_buy` cost basis from listing USDC price |

---

### `POST /api/marketplace/orders/fulfill-matched-pair`

Marks both the ask and the bid fulfilled after `matchAdvancedOrders` (token offer or legacy criteria). Buyer cost basis is seeded from the ask fill price (`bid.offerer` wallet, `source = marketplace_buy`).

Seller **take-offer** flows (Edit price primary; Accept offer secondary) are specified in [seaport-accept-offer.md](../architecture/seaport-accept-offer.md). Deep links: `/portfolio?setprice=` (Edit price) and `/portfolio?acceptBid=&tokenId=` (+ optional `askHash`). RQ: `invalidateAfterAcceptOffer` / `invalidateAfterDeadBid`. Edit-price instant match that fails on buyer USDC keeps the ask at the set price.

**Body:** `FulfillMatchedPairDto`

```json
{ "askOrderHash": "0x...", "bidOrderHash": "0x..." }
```

---

## Collections

### `GET /api/marketplace/collections`

Returns a cursor-paginated list of collection summaries, or a **text search** when `q` is set.

| Query | Default | Description |
|-------|---------|-------------|
| `limit` | `30` | Max `60` (browse) / max `40` (when `q` set) |
| `cursor` | — | Opaque cursor from prior page `nextCursor` (ignored when `q` is set) |
| `q` | — | Free-text search across label, queryUsed, card name/set, PSA subject/brand/variety, cert, and (length ≥ 4) collection key. Results ranked by active listing count then recency. `nextCursor` is always `null`. |

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

Daily portfolio value history for charts. Rows are written by the **09:00 KST cron** (`portfolio_daily_snapshots`) **per chain**. Read path backfills **only** if today's slot row is missing for the request chain (does not overwrite existing rows). After a holding change (direct mint, custody deliver, marketplace fill, hide/unhide, burn), the backend **overwrites today's slot** so the Portfolio value chart updates without waiting for the next cron. GET itself never recaptures an existing row.

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

**Portfolio totals:** `portfolio_daily_snapshots` (09:00 KST cron + read-path backfill if today's row is missing + event-driven recapture after mint/buy/deliver/hide/burn) drives **Portfolio value** and **24h P/L** in the hero/chart. Per-row **My Assets P/L** uses `portfolio_holdings` cost basis vs live mark.

---

## ~~My Assets (Hidden Tokens) — legacy~~

The former `hidden_assets` table and `GET/POST/PATCH /api/marketplace/my-assets/hidden` routes are **gone**. Use **`portfolio/hidden`** above.

---

> **Note:** The following section documented a **removed** relational HTTP API. It is kept only for archive search; these routes **do not exist** in the current backend.

## ~~Relational Trading Layer (removed)~~

The former `GET /api/marketplace/bids`, `POST /api/marketplace/trade/match`, and related settlement-worker tables are **not** in the repository anymore. Use **Seaport** orders and on-chain fulfillment only.

---
