# RWA API

**Controller:** `backend/src/rwa/rwa.controller.ts`  
**Base path:** `/api/rwa`  
**Swagger tag:** `rwa`

Handles the full vault deposit pipeline: IPFS metadata upload → platform-signed on-chain mint → redemption request.

---

## `POST /api/rwa/upload`

**Content-Type:** `multipart/form-data`

Uploads card image and metadata to **Pinata (IPFS)** and returns a `tokenURI`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Token name |
| `description` | string | Yes | Token description |
| `image` | file | No* | JPEG/PNG image file (max 10 MB) |
| `imageUrl` | string | No* | External image URL |
| `attributes` | string | No | JSON string — `[{"trait_type": "...", "value": "..."}]` |
| `gradedMetadata` | string | No | JSON — `{ graded, … }` from Vault PSA analyze (**PSA 10 required**) |

\* Either `image` file or `imageUrl` must be provided.

**Mint gate:** Graded metadata must be PSA with numeric grade **10** (`400` otherwise).

**Response:**

```json
{
  "tokenURI": "ipfs://Qm.../metadata.json",
  "metadataCid": "Qm...",
  "imageCid": "Qm...",
  "imageUrl": "https://gateway.pinata.cloud/ipfs/Qm..."
}
```

---

## `POST /api/rwa/mint`

**Guard:** `JwtAuthGuard`

Platform-signed on-chain mint to the custody wallet, with intent to deliver to the requesting user.

**Request body:**

```json
{
  "recipientAddress": "0xUserLinkedWalletAddress",
  "tokenURI": "ipfs://Qm.../metadata.json",
  "certNumber": "83179580"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `recipientAddress` | Yes | Must be linked to the authenticated user account |
| `tokenURI` | Yes | From `POST /rwa/upload` |
| `certNumber` | Yes | PSA cert number — permanent physical asset identity; used to derive `vaultRef = keccak256(certNumber.toUpperCase())` |

**Flow:**
1. Validates `recipientAddress` is linked to the JWT user's account
2. `VaultService.reserveCycleForDeposit()` — opens a vault cycle; fails if cert already has open cycle
3. `RwaChainWriterService.mintTo(custodyWallet, tokenURI, vaultRef)` — backend wallet signs mint tx
4. `VaultService.recordMintResult()` — links `rwa_tokens` row to vault cycle

**Response:**

```json
{
  "tokenId": 4,
  "tokenURI": "ipfs://...",
  "vaultRef": "0xkeccak256...",
  "txHash": "0x...",
  "chainId": 11155111,
  "custodyWallet": "0xPlatformCustodyAddress",
  "intendedRecipient": "0xUserPrimaryWalletAddress"
}
```

**Errors:**
- `403` — `recipientAddress` not linked to the authenticated user
- `409` — This PSA cert already has an open vault cycle (must redeem first)
- `400` — Invalid wallet address or missing tokenURI/certNumber
- `500` — On-chain mint failed (gas, RPC issue); vault cycle is cancelled automatically

---

## `POST /api/rwa/redeem-request`

**Guard:** `JwtAuthGuard`

User-initiated redemption request. Verifies the caller currently owns the NFT, then records the request. Actual on-chain burn + physical vault release are ops steps (see admin endpoints).

**Request body:**

```json
{
  "tokenId": 4,
  "ownerWalletAddress": "0xTokenOwnerWalletAddress"
}
```

**Flow:**
1. Validates `ownerWalletAddress` is linked to the JWT user
2. Verifies on-chain ownership matches `ownerWalletAddress`
3. `VaultService.requestRedemption()` — creates `vault_redemptions` row, sets cycle to `redemption_requested`

**Response:**

```json
{
  "redemptionId": "uuid",
  "tokenId": "4",
  "status": "pending"
}
```

**Next steps (admin):**
- `POST /api/marketplace/admin/rwa-tokens/:tokenId/burn` — burns token + sets cycle to `redeemed`
- `POST /api/marketplace/admin/rwa-tokens/redemptions/:redemptionId/confirm-release` — marks physical card as released

---

## Admin RWA endpoints

See [marketplace-admin.md](./marketplace-admin.md) for the full admin RWA API including:

- `GET /custody-nfts` — list NFTs in platform custody
- `POST /:tokenId/deliver` — transfer NFT to user's primary wallet
- `POST /:tokenId/burn` — on-chain adminBurn + vault cycle completion
- `GET /vault-history/:certNumber` — audit history

---

## Related Environment Variables

| Variable | Purpose |
|----------|---------|
| `PINATA_JWT` | Pinata API JWT for uploads |
| `PINATA_GATEWAY` | Custom Pinata gateway domain |
| `RWA_OWNER_PRIVATE_KEY` | Platform minter/burner signer (MINTER_ROLE + BURNER_ROLE) |
| `RWA_CUSTODY_WALLET_ADDRESS` | Address of custody wallet (defaults to derived from owner key) |
| `RWA_CUSTODY_PRIVATE_KEY` | Optional separate key if custody != minter |
| `CHAIN_11155111_RWA_ADDRESS` | TokenableRWA proxy on Sepolia |
| `CHAIN_1_RWA_ADDRESS` | TokenableRWA proxy on Ethereum mainnet |
