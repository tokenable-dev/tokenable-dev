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

**Pre-flight:** honors `x-tokenable-chain-id` — throws `409` only if the cert already has an open vault cycle **on that chain** (cycles are chain-scoped; a live Sepolia NFT does not block a Polygon mint).

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

Platform-signed on-chain mint. Default: custody wallet (admin delivers later). Self vault: `deliveryMode: "direct"` mints to the user's linked wallet.

**Request body:**

```json
{
  "recipientAddress": "0xUserLinkedWalletAddress",
  "tokenURI": "ipfs://Qm.../metadata.json",
  "certNumber": "83179580",
  "deliveryMode": "custody"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `recipientAddress` | Yes | Must be linked to the authenticated user account |
| `tokenURI` | Yes | From `POST /rwa/upload` |
| `certNumber` | Yes | PSA cert number — permanent physical asset identity; used to derive `vaultRef = keccak256(certNumber.toUpperCase())` |
| `deliveryMode` | No | `custody` (default) or `direct` (self vault — mint to `recipientAddress`) |

**Flow:**
1. Validates `recipientAddress` is linked to the JWT user's account
2. `VaultService.reserveCycleForDeposit()` — opens a vault cycle; fails if cert already has open cycle
3. `RwaChainWriterService.mintTo(mintTo, tokenURI, vaultRef)` — `mintTo` is custody (`custody`) or `recipientAddress` (`direct`)
4. `VaultService.recordMintResult()` — links `rwa_tokens` to vault cycle; sets `settlement_policy` to `self_vault_hold` when `direct`, else `standard`
5. If `direct`: seeds `vault_delivery` cost basis from current mark USD (same as admin deliver)

**Response:**

```json
{
  "tokenId": 4,
  "tokenURI": "ipfs://...",
  "vaultRef": "0xkeccak256...",
  "txHash": "0x...",
  "chainId": 11155111,
  "custodyWallet": "0xPlatformCustodyAddress",
  "mintedTo": "0xPlatformCustodyAddress",
  "intendedRecipient": "0xUserPrimaryWalletAddress",
  "deliveryMode": "custody"
}
```

For self vault (`deliveryMode: "direct"`), `mintedTo` equals `intendedRecipient` (user wallet).

**Errors:**
- `403` — `recipientAddress` not linked to the authenticated user
- `409` — This PSA cert already has an open vault cycle (must redeem first)
- `400` — Invalid wallet address or missing tokenURI/certNumber
- `500` — On-chain mint failed (gas, RPC issue); vault cycle is cancelled automatically

---

## `POST /api/rwa/redeem-request`

**Guard:** `JwtAuthGuard` · **Header:** `x-tokenable-chain-id` (required)

User-initiated redemption request from Portfolio → Redeem. Verifies the caller currently owns the NFT on the requested chain, requires KYC Level 2 (`assertKycApprovedForCustody`), then records the request with optional ship-to address. Actual on-chain burn + physical vault release are ops steps (see admin endpoints).

USDC payment (`WD_READY_TO_PAY`) is **not** implemented yet (Phase B). Shipping / redeem fee **estimates** are available via `GET /api/rwa/redeem/estimate` (PSA Vault published rates).

**Request body:**

```json
{
  "tokenId": 4,
  "shipTo": {
    "name": "Daisy Kim",
    "line1": "123 Market St",
    "line2": "Apt 4",
    "city": "San Francisco",
    "region": "CA",
    "postal": "94105",
    "country": "us",
    "phone": "+1 555 000 0000"
  }
}
```

`shipTo.country` is one of `us` | `ca` | `intl`. Address fields are stored on `vault_redemptions` (`ship_to_*` columns).

**Flow:**
1. Asserts KYC approved for custody
2. Loads on-chain owner for `tokenId` on the chain from the header
3. Verifies that owner is a wallet linked to the JWT user
4. `VaultService.requestRedemption()` — creates `vault_redemptions` row (`ownership_verified`), sets cycle to `redemption_requested`, emits `WD_REQUEST_RECEIVED`
5. Marketplace listing create is blocked while the cycle is `redemption_requested` / `redeemed`

**Response:** `VaultRedemption` entity (includes `id`, `status`, ship-to fields).

**Next steps (admin):**
- `POST /api/marketplace/admin/rwa-tokens/:tokenId/burn` — burns token + sets cycle to `redeemed`
- `POST /api/marketplace/admin/rwa-tokens/redemptions/:redemptionId/confirm-release` — marks physical card as released (`WD_SHIPPED` → FE `/portfolio/redeem?view=transit`)

---

## `GET /api/rwa/redemptions/mine`

**Guard:** `JwtAuthGuard`

Lists the signed-in user's redemption rows (excludes `failed` / `cancelled`) for portfolio badges and redeem status surfaces.

**Query:** `tokenIds` (optional CSV of numeric token IDs)

**Response:** array of `{ redemptionId, tokenId, tokenContract, status, vaultCycleStatus, requestedAt, vaultReleasedAt }`

---

## `GET /api/rwa/redeem/estimate`

**Guard:** none (public rate schedule)

Returns an estimate of redeem cost from the PSA Vault published shipping schedule plus per-card withdraw fee.

**Query:**

| Param | Required | Notes |
|-------|----------|--------|
| `country` | yes | `us` \| `ca` \| `intl` |
| `cardCount` | no | 1–50, default `1` |

**Response:**

```json
{
  "currency": "USD",
  "country": "us",
  "cardCount": 2,
  "shippingUsd": 5.99,
  "withdrawFeePerCardUsd": 4.99,
  "withdrawFeeTotalUsd": 9.98,
  "totalUsd": 15.97,
  "source": "psa_vault_published_schedule"
}
```

`withdrawFeePerCardUsd` defaults to `4.99` and can be overridden with env `PSA_VAULT_WITHDRAW_FEE_USD`. Shipping: US `$5.99`, Canada `$24.99`, other international `$31.99` (up to 50 items per shipment).

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
| `PSA_VAULT_WITHDRAW_FEE_USD` | Optional override for per-card redeem withdraw fee (default `4.99`) |
| `PINATA_JWT` | Pinata API JWT for uploads |
| `PINATA_GATEWAY` | Custom Pinata gateway domain |
| `RWA_OWNER_PRIVATE_KEY` | Platform minter/burner signer (MINTER_ROLE + BURNER_ROLE) |
| `RWA_CUSTODY_WALLET_ADDRESS` | Address of custody wallet (defaults to derived from owner key) |
| `RWA_CUSTODY_PRIVATE_KEY` | Optional separate key if custody != minter |
| `CHAIN_11155111_RWA_ADDRESS` | TokenableRWA proxy on Sepolia |
| `CHAIN_1_RWA_ADDRESS` | TokenableRWA proxy on Ethereum mainnet |
| `CHAIN_137_RWA_ADDRESS` | TokenableRWA proxy on Polygon mainnet |

Mint and redeem honor `x-tokenable-chain-id` so the write lands on that chain’s RWA address and `rwa_tokens.token_contract`. Vault cycles carry `chain_id` — the "one open cycle per cert" rule is enforced per (asset, chain), matching the per-contract `activeTokenIdByVaultRef` invariant.
