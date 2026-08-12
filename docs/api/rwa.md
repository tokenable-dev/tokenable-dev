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
  "metadata": { },
  "displayImageUrl": "https://YOUR_CDN/dev/covers/rwa-slabs/84532/84089328/slab"
}
```

`displayImageUrl` is set when catalog S3 is configured (`CATALOG_COVER_S3_*`). The slab image is downloaded once (PSA URL or uploaded file), pinned to IPFS for `metadata.image`, and copied to S3 for fast UI reads. If S3 ingest fails, upload still succeeds and `displayImageUrl` is `null`.

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
  "deliveryMode": "custody",
  "displayImageUrl": "https://YOUR_CDN/dev/covers/rwa-slabs/84532/83179580/slab"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `recipientAddress` | Yes | Must be linked to the authenticated user account |
| `tokenURI` | Yes | From `POST /rwa/upload` |
| `certNumber` | Yes | PSA cert number — permanent physical asset identity; used to derive `vaultRef = keccak256(certNumber.toUpperCase())` |
| `deliveryMode` | No | `custody` (default) or `direct` (self vault — mint to `recipientAddress`; **active marketplace partner wallet + company Origin address required**) |
| `displayImageUrl` | No | Pass through from upload response. Stored on `rwa_tokens.display_image_url` only when the URL matches the platform S3 key for this `certNumber` + chain. Spoofed URLs are ignored (mint still succeeds). |

**Mint paths that set `display_image_url`:** sell/custody upload+mint (Phase 1), partner bulk mint prepare+commit (Phase 2), vault submission admin mint, P2P listing create (optional `displayImageUrl` / `imageUrl`). Legacy rows: admin `POST /marketplace/admin/rwa-slab/backfill-display-images` (Phase 3).

**Local QA (upload prep, no on-chain mint):**

```bash
cd backend
pnpm exec ts-node -r tsconfig-paths/register scripts/simulate-rwa-mint-prep.ts 151380671
pnpm exec ts-node -r tsconfig-paths/register scripts/simulate-rwa-mint-prep.ts 151380671 --upload
```

**Self vault (`direct`) errors (403):**

| `code` | When |
|--------|------|
| `SELF_VAULT_PARTNER_ONLY` | Wallet is not an active `marketplace_partners` row |
| `COMPANY_ADDRESS_REQUIRED` | Partner has no `marketplace_partner_addresses` Origin — set in Settings → Addresses |

Backend enforcement is via `MarketplacePartnersService.assertSelfVaultEligibleForWallet` (do not rely on frontend alone). PSA vault (`custody`), markets, redeem-batch, and settlements are **not** gated by company address.

**Flow:**
1. Validates `recipientAddress` is linked to the JWT user's account
2. If `direct`: asserts partner + company Origin (`COMPANY_ADDRESS_REQUIRED` / `SELF_VAULT_PARTNER_ONLY`)
3. `VaultService.reserveCycleForDeposit()` — opens a vault cycle; fails if cert already has open cycle
4. `RwaChainWriterService.mintTo(mintTo, tokenURI, vaultRef)` — `mintTo` is custody (`custody`) or `recipientAddress` (`direct`)
5. `VaultService.recordMintResult()` — links `rwa_tokens` to vault cycle; sets `settlement_policy` to `self_vault_hold` when `direct`, else `standard`; stores `vault_partner_id` for Self vault labels
6. If `direct`: seeds `vault_delivery` cost basis from current mark USD (same as admin deliver)

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

## `POST /api/rwa/redeem-batch`

**Guard:** `JwtAuthGuard` · **Header:** `x-tokenable-chain-id` (required) · **v1 chain:** Sepolia (`11155111`) only

Pay-first multi-card redeem. Client transfers USDC to `PLATFORM_FEE_RECIPIENT`, then posts the tx hash with `tokenIds` + `shipTo`. Backend verifies the ERC-20 `Transfer` amount ≥ estimate, stores the **exact** receipted amount as `payment_received_usdc_micros` (canonical refund amount — never recompute from fees), and creates one `vault_redemptions` row per token (`status=ownership_verified`) with fee snapshots.

**Quote pinning:** the server recomputes the estimate at verification time, but carrier rates can drift between the buyer's quote and this recompute. Payment is accepted against the **cheaper** of the fresh total and any unexpired recently issued estimate for the same token set + destination (in-memory, TTL = quote validity) — a completed USDC transfer is never rejected by re-quote drift.

**Missing vault cycle self-heal:** if an `rwa_tokens` row has no `vault_cycle_id` (e.g. row created by the chain registry sync after a DB reset) but has a PSA cert on file, batch creation backfills the `vault_assets` / `vault_cycles` records (status `minted`, unknown `deposited_at` → treated as early withdrawal) instead of stranding a paid redeem. Tokens with no registry row or no cert fail the **estimate** with a clear message before any payment.

```json
{
  "tokenIds": [4, 5],
  "shipTo": { "name": "…", "line1": "…", "city": "…", "postal": "…", "country": "us", "phone": "…" },
  "paymentTxHash": "0x…"
}
```

**Response includes** `paymentBatchId`, `paymentReceivedUsdcMicros`, `custodyWalletAddress` (`RWA_CUSTODY_WALLET_ADDRESS`), `nextStep: "transfer_nfts_to_custody"`.

Payment uniqueness is enforced by `vault_redeem_payment_claims.payment_tx_hash` (PRIMARY KEY). Batch row creation runs in a single DB transaction so a failed card rolls back the claim and all sibling rows.

Fee snapshot columns: `fee_retrieval_usd`, `fee_early_withdrawal_usd`, `fee_shipping_usd`, `fee_total_usd`, `payment_tx_hash`, `payment_batch_id`, `paid_at`, `payment_received_usdc_micros`, `vaulted_at`, `early_withdrawal`, `chain_id`.

Early withdrawal uses `vault_cycles.deposited_at` vs `PSA_VAULT_EARLY_WITHDRAWAL_DAYS` (default 90). Unknown age → early fee charged (conservative).

### `POST /api/rwa/redeem-batch/:batchId/custody`

**Guard:** `JwtAuthGuard` · **Header:** `x-tokenable-chain-id`

After the buyer **user-signs** ERC-721 `safeTransferFrom` into `RWA_CUSTODY_WALLET_ADDRESS`, post transfer hashes for tokens still needing confirmation. Backend verifies Transfer logs + current `ownerOf` == custody, then marks each row `in_custody`. Tokens **already** owned by custody on-chain (partial resume after wallet cancel) are accepted without a new tx — `transfers` may be `[]` when every outstanding NFT is already at custody. **No partial advance** — any token still in the user wallet without a matching transfer → 400. When `allInCustody=true`, the redeem UI may show Preparing.

```json
{
  "transfers": [
    { "tokenId": 4, "txHash": "0x…" },
    { "tokenId": 5, "txHash": "0x…" }
  ]
}
```

The backend never pulls NFTs from the buyer. PSA Vault and Partner Self Vault share this custody intake; shipping provider differs later.

**Ops after custody:** Admin sets **tracking per vault shipment** (and optional **carrier**) → user In transit. User confirms receipt via `confirm-received` → Done (`completed`). Burn / confirm-release may still follow for ops. Admin refunds (USDC + NFT return) until a tracking number is set — see `docs/api/marketplace-admin.md` Redeems.

### `POST /api/rwa/redeem-batch/:batchId/confirm-received`

**Guard:** `JwtAuthGuard` · `x-tokenable-chain-id` **required**

User tap **I've received my cards**. Batch must belong to the active chain. Requires every row in the payment batch to have a `tracking_number`, and status ∈ `in_custody` | `burned` | `vault_release_pending` | `completed`. Sets all rows to `completed` + `vault_released_at`. Idempotent if already completed.

## `POST /api/rwa/redeem-request`

**Deprecated** for unpaid calls — returns 400 directing clients to `redeem-batch`.

---

## `GET /api/rwa/redemptions/mine`

**Guard:** `JwtAuthGuard` · `x-tokenable-chain-id` **required**

Lists the signed-in user's redemption rows on the **active chain** (`COALESCE(vault_redemptions.chain_id, vault_cycles.chain_id)`), excluding `failed` / `cancelled` — for portfolio badges and redeem status surfaces, including **`completed`** (Redeem tab history).

**Query:** `tokenIds` (optional CSV of numeric token IDs)

**Response:** array of `{ redemptionId, tokenId, tokenContract, status, vaultCycleStatus, requestedAt, vaultReleasedAt, paymentBatchId, paymentTxHash, custody…, feeRetrievalUsd, feeEarlyWithdrawalUsd, feeShippingUsd, feeTotalUsd, paymentReceivedUsdcMicros, earlyWithdrawal }` — fee columns are **per-card snapshots**; `paymentReceivedUsdcMicros` is **batch-total** (identical on sibling rows — do not SUM).

---

## `GET /api/rwa/redeem/estimate`

**Guard:** none · `x-tokenable-chain-id` **required** when `tokenIds` is set

When `tokenIds` is set, the estimate first runs a **redeemability check** (`VaultService.assertTokensRedeemable`): token must exist in `rwa_tokens`, not be burned, and its vault cycle (if any) must be `minted`. Tokens missing a cycle but with a cert on file pass (backfilled at pay). This surfaces blockers at "Calculate" time — **before** any USDC moves.

Estimates may group tokens into **multiple shipments** (one USDC total):

| Provider | How detected | Shipping |
|----------|--------------|----------|
| PSA Vault | `rwa_tokens.settlement_policy = standard` | Published PSA schedule |
| Partner Self vault | `settlement_policy = self_vault_hold` + `vault_partner_id` | FedEx Rate client (`FEDEX_RATE_ENABLED`) or stub (`PARTNER_VAULT_SHIPPING_*`) from partner Origin → ship-to |

PSA schedule:

| Component | Default |
|-----------|---------|
| Retrieval | `$1.99` / card (`PSA_VAULT_RETRIEVAL_FEE_USD`) |
| Early withdrawal | `+$4.99` / card if vaulted &lt; 90d |
| Shipping | US `$5.99` · CA `$24.99` · intl `$31.99` once per **PSA** shipment ≤50 |

Partner path: no retrieval/early; shipping once per Partner Origin shipment via **FedEx Rates API** when `FEDEX_RATE_ENABLED=true` (else `PARTNER_VAULT_SHIPPING_*` stub). Partner Origin missing → `400` `COMPANY_ADDRESS_REQUIRED`. **Korea → Korea** Partner lanes are unsupported (no stub price) — buyer sees an English message to change the vault ship-from country.

Destination country for FedEx must be **ISO-3166 alpha-2** via `shipTo.countryCode` (required when fee bucket `country` is `intl`). Buckets `us`/`ca` map to `US`/`CA` when `countryCode` is omitted. Backend **never** infers country from phone or uses `XX`.

FedEx selects the **cheapest** service among ACCOUNT-priced rows when available (else LIST). Quotes include `expiresAt` (default 15 minutes, `FEDEX_RATE_QUOTE_TTL_MINUTES`) surfaced on Partner shipments / estimate as `shippingQuoteExpiresAt`.

Rate failures return a stable body `{ code, category, message }` (e.g. `FEDEX_RATE_RETRYABLE`, `FEDEX_RATE_INVALID_ADDRESS`) — buyers see the friendly `message`; server logs keep the raw FedEx code/text. Transient failures (FedEx 5xx/429, network errors) are **retried once** before falling back to the stub (`FEDEX_RATE_FALLBACK_STUB`) or surfacing the error.

**Query (GET):** `country`, `cardCount?`, `tokenIds?` (CSV)

**Body (POST)** preferred for Partner Rate: same fields + `shipTo` (full address + optional `countryCode`). Frontend Calculate uses POST.

**Response** includes totals plus `shipments[]` (`provider`, `vaultLabel`, fee lines, `shippingSource`, optional FedEx quote metadata) and flat `cards[]` for payment reconciliation.

| Env | Purpose |
|-----|---------|
| `PSA_VAULT_*` | PSA fee schedule |
| `FEDEX_RATE_ENABLED` | `true` to call FedEx Rate (sandbox or prod base URL) |
| `FEDEX_API_BASE_URL` | Default `https://apis-sandbox.fedex.com` |
| `FEDEX_CLIENT_ID` / `FEDEX_CLIENT_SECRET` / `FEDEX_ACCOUNT_NUMBER` | Project credentials |
| `FEDEX_RATE_BASE_WEIGHT_LB` / `FEDEX_RATE_WEIGHT_PER_CARD_LB` | Package weight for Rate |
| `FEDEX_RATE_QUOTE_TTL_MINUTES` | Quote validity window (default `15`) |
| `FEDEX_RATE_FALLBACK_STUB` | Optional: stub on *any* Rate failure. **KR→KR is never stubbed** — estimate fails with a clear message instead. |
| `PARTNER_VAULT_SHIPPING_US/CA/INTL_USD` | Stub when Rate disabled |
| `PLATFORM_FEE_RECIPIENT` | USDC pay destination |

Architecture: `RedeemShippingFeeCalculator` + `ShippingRateClient` (`FedExRateClient`) under `backend/src/rwa/` — UPS/DHL can add parallel clients later.

Admin Swagger probe (raw FedEx request/response): `POST /api/marketplace/admin/fedex/rate-probe` — see `docs/api/marketplace-admin.md`.

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
