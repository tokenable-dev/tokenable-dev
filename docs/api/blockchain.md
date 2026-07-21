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
  "imageUrl": "https://gateway.pinata.cloud/ipfs/Qm..."
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
  { "tokenId": 1, "metadata": {...}, "imageUrl": "https://..." },
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

The backend resolves the target chain from the `x-tokenable-chain-id` request header (set by the frontend `lib/chains/apiHeader.ts`). Supported chain IDs: `11155111` (Ethereum Sepolia), `1` (Ethereum mainnet). Each chain is configured independently:

| Variable pattern | Purpose |
|-----------------|---------|
| `CHAIN_11155111_RPC_URL` | Sepolia RPC |
| `CHAIN_11155111_RWA_ADDRESS` | TokenableRWA on Sepolia |
| `CHAIN_11155111_USDC_ADDRESS` | USDC on Sepolia (Circle testnet) |
| `CHAIN_1_RPC_URL` | Ethereum mainnet RPC |
| `CHAIN_1_RWA_ADDRESS` | TokenableRWA on mainnet |
| `CHAIN_1_USDC_ADDRESS` | USDC on mainnet (Circle) |
| `DEFAULT_CHAIN_ID` | Default chain when header absent (default `11155111`) |
| `PINATA_GATEWAY` | Custom gateway for resolving IPFS CIDs |
