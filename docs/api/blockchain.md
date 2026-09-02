# Blockchain API

**Controller:** `backend/src/blockchain/blockchain.controller.ts`  
**Base path:** `/api/blockchain`  
**Swagger tag:** `blockchain`

Read-only access to configured EVM chains (Ethereum Sepolia and Ethereum mainnet). Wraps two contracts per chain:

- **USDC** (ERC-20) — payment token (Circle testnet USDC on Sepolia; Circle USDC on mainnet)
- **TokenableRWA** (ERC-721) — graded-card NFTs

IPFS URIs are resolved server-side via multiple gateways with a CID result cache. Browsers should never fetch IPFS directly.

---

## USDC Routes

### `GET /api/blockchain/token/info`

Returns USDC contract metadata.

```json
{ "name": "USD Coin", "symbol": "USDC", "decimals": 6 }
```

---

### `GET /api/blockchain/token/supply`

Returns USDC totalSupply as a raw string (6-decimal units).

---

### `GET /api/blockchain/token/balance/:address`

Returns USDC balance for `address` as a raw string.

| Param | Description |
|-------|-------------|
| `address` | EVM wallet address (0x…) |

---

## TokenableRWA Routes

### `GET /api/blockchain/rwa/info`

Returns contract info.

```json
{ "name": "TokenableRWA", "symbol": "TRWA", "totalMinted": 42 }
```

---

### `GET /api/blockchain/rwa/owner/:tokenId`

Returns `ownerOf(tokenId)` as a checksummed address string.

---

### `GET /api/blockchain/rwa/asset/:tokenId`

Server-side pipeline: reads `tokenURI`, fetches IPFS metadata, resolves image to an `https://` URL.

```json
{
  "tokenId": 1,
  "tokenURI": "ipfs://Qm.../metadata.json",
  "metadata": { "name": "...", "description": "...", "attributes": [...] },
  "imageUrl": "https://gateway.pinata.cloud/ipfs/Qm...",
  "imageBackUrl": "https://YOUR_CDN/dev/covers/rwa-slabs/84532/83179580/slab-back"
}
```

---

### `GET /api/blockchain/rwa/token-uri/:tokenId`

Returns the raw `tokenURI` string (e.g. `ipfs://Qm.../metadata.json`).

---

### `GET /api/blockchain/rwa/balance/:address`

Returns number of RWA tokens held by `address`.

---

### `GET /api/blockchain/rwa/tokens/:address`

Returns array of tokenIds owned by `address`.

```json
[1, 5, 12, 99]
```

When the owner index is ready (`rwa_owner_index_cursors.backfill_complete` for the chain's RWA contract), this route reads `rwa_tokens.owner_wallet` (one indexed SQL query). Until backfill completes, it falls back to a full-supply `ownerOf` scan and persists discovered owners for the next request.

Enable indexing: `RWA_OWNER_INDEX_ENABLED=1` (boot backfill + live Transfer listener). **Required for log replay:** `CHAIN_{id}_RWA_DEPLOY_BLOCK` = TokenableRWA deploy block (without it, log backfill is skipped to avoid scanning genesis→head and hitting RPC 429s; portfolio still works via `ownerOf` scan + live Transfer listener). Optional tuning: `RWA_OWNER_INDEX_LOG_CHUNK` = inclusive blocks per `eth_getLogs` (default **10**, Alchemy Free), `RWA_OWNER_INDEX_LOG_DELAY_MS` (default **600**), `RWA_OWNER_INDEX_MAX_BLOCKS_PER_RUN` (default **500** — pauses between passes), `RWA_OWNER_INDEX_BACKFILL_PASS_DELAY_MS` (default **60000**), `RWA_OWNER_INDEX_POLL_MS` (default **60000** — active poll while backfilling), `RWA_OWNER_INDEX_IDLE_POLL_MS` (default **120000** — after all chains indexed), `RWA_OWNER_INDEX_POLL_MAX_BLOCKS` (default **50** per poll), `RWA_OWNER_INDEX_LOG_MAX_RETRIES` (default 6).

**Alchemy Free RPC budget** (defaults tuned for Free tier CU/s):

| Env | Default | Purpose |
|-----|---------|---------|
| `RPC_MAX_CONCURRENCY` | `2` | Max in-flight JSON-RPC calls (global semaphore) |
| `RPC_BATCH_CHUNK_DELAY_MS` | `250` | Pause between batched `ownerOf` / `tokenURI` chunks |
| `RPC_OWNER_SCAN_CONCURRENCY` | `4` | Parallel `ownerOf` during full-supply wallet scan |
| `RPC_METADATA_BATCH_CONCURRENCY` | `2` | Parallel on-chain `tokenURI` reads when DB has no `token_uri` |

Portfolio metadata batch prefers `rwa_tokens.token_uri` (IPFS only — **no on-chain read**) when the registry row exists. Mint writes use the same semaphore + 429 backoff.

Defenses: address format validated (400 on invalid), result cached **120s** per `(chainId, address)`, concurrent identical scans coalesced, rate-limited to 30 req/min per IP.

---

### `POST /api/blockchain/rwa/metadata/batch`

Resolves metadata and image URLs for a list of token IDs in parallel. Uses server-side IPFS gateway fallbacks and CID cache.

**Request body:** `RwaMetadataBatchDto`

```json
{ "tokenIds": [1, 2, 3] }
```

**Response:**

```json
[
  { "tokenId": 1, "metadata": {...}, "imageUrl": "https://...", "imageBackUrl": null },
  ...
]
```

---

### `POST /api/blockchain/media/resolve`

Resolves an array of IPFS or IPFS-gateway URIs to browser-loadable `https://` URLs.

**Request body:** `MediaResolveDto`

```json
{
  "uris": [
    "ipfs://bafybeib.../image.png",
    "https://gateway.pinata.cloud/ipfs/bafybei..."
  ]
}
```

**Response:**

```json
{
  "items": [
    { "uri": "ipfs://bafybeib.../image.png", "httpsUrl": "https://..." },
    ...
  ]
}
```

---

## Multi-chain support

The backend resolves the target chain from the `x-tokenable-chain-id` request header (set by the frontend `lib/chains/apiHeader.ts`). Supported chain IDs: `11155111` (Ethereum Sepolia), `1` (Ethereum mainnet), `137` (Polygon mainnet). Each chain is configured independently:

| Variable pattern | Purpose |
|-----------------|---------|
| `CHAIN_11155111_RPC_URL` | Sepolia RPC |
| `CHAIN_11155111_RWA_ADDRESS` | TokenableRWA on Sepolia |
| `CHAIN_11155111_USDC_ADDRESS` | USDC on Sepolia (Circle testnet) |
| `CHAIN_1_RPC_URL` | Ethereum mainnet RPC |
| `CHAIN_1_RWA_ADDRESS` | TokenableRWA on mainnet |
| `CHAIN_1_USDC_ADDRESS` | USDC on mainnet (Circle) |
| `CHAIN_137_RPC_URL` | Polygon mainnet RPC |
| `CHAIN_137_RWA_ADDRESS` | TokenableRWA on Polygon |
| `CHAIN_137_USDC_ADDRESS` | Native USDC on Polygon (`0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`) |
| `DEFAULT_CHAIN_ID` | Default chain when header absent (default `11155111`) |
| `PINATA_GATEWAY` | Custom gateway for resolving IPFS CIDs |

Inventory isolation: marketplace rows (`rwa_tokens`, `orders`, `portfolio_holdings`) are keyed by per-chain `token_contract` (= `CHAIN_{id}_RWA_ADDRESS`). Switching the header must never return another chain’s mints.

Collection detail orderbook and market reads (`GET /marketplace/collections/:key`, `…/stats`, `…/platform-trades`, `…/market-series`, `GET /marketplace/rwa/:tokenId/trades`, portfolio/market batch snapshots) also filter by that chain’s RWA `token_contract` and USDC address. Shared `collection_key` / Cardhedger snapshots stay cross-chain by design.

`portfolio_daily_snapshots` are unique on `(wallet_address, snapshot_date_kst, chain_id)`. The 09:00 KST cron captures each configured chain separately; `GET /marketplace/portfolio/daily/:wallet` returns history for the request chain only.

Admin platform analytics (`GET /marketplace/admin/analytics`) scopes mints / orders / GMV / holdings / snapshot counts to the request chain. Users, watchlist, and collection catalog totals remain global.

Collection bootstrap (`ensureCollectionForListing`), mint-previews, on-mint sync, and P2P create/list honor `x-tokenable-chain-id` (or the order’s `token_contract`). Snapshot refresh discovery / daily prewarm only consider activity on configured RWA contracts.

Public app users are locked to Sepolia (`PUBLIC_APP_CHAIN_ID = 11155111`). The network switcher is internal/dev-only. Vault open cycles remain global per PSA cert — a cert with an open Sepolia vault submission cannot be reminted on Polygon until that cycle closes.
