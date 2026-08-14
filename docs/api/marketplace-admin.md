# Marketplace Admin API

**Base path:** `/api/marketplace/admin`  
**Auth:** Admin session cookie (`marketplace_admin`) — separate from user JWT  
**Login:** `POST /api/marketplace/admin/auth/login` with `{ username, password }`

---

## Auth

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/session` | Check if admin session is active |
| POST | `/auth/login` | Login with username/password |
| POST | `/auth/logout` | Clear admin session |

Admin credentials are stored in `marketplace_admins` table. Set via `MARKETPLACE_ADMIN_USERNAME` / `MARKETPLACE_ADMIN_PASSWORD` env vars (dev defaults: `skyand` / `071725`).

---

## RWA Tokens

**Controller:** `rwa-token-admin.controller.ts`  
**Base:** `/api/marketplace/admin/rwa-tokens`  
**Chain:** all list/write routes honor `x-tokenable-chain-id` (admin console network switcher). Missing header falls back to `DEFAULT_CHAIN_ID`.

### GET /cards

All RWA tokens in the registry for the active chain (listed + unlisted + burned).

**Response:**

```json
{
  "items": [
    {
      "tokenId": 4,
      "certNumber": "83179580",
      "displayName": "2003 Topps LeBron PSA 10",
      "displayImageUrl": null,
      "catalogImageUrl": "https://...",
      "resolvedImageUrl": "https://...",
      "collectionKey": "...",
      "orderHash": "0x...",
      "priceUsdc": 500.00,
      "offerer": "0x...",
      "hasActiveListing": true,
      "burnedAt": null,
      "vaultCycleStatus": "minted"
    }
  ]
}
```

### GET /custody-nfts

NFTs currently held in the platform custody wallet, pending delivery to vault depositors.

**Response:**

```json
{
  "custodyWallet": "0xD5ab...",
  "items": [
    {
      "tokenId": 5,
      "certNumber": "99887766",
      "displayName": "...",
      "resolvedImageUrl": "https://...",
      "onChainOwner": "0xD5ab...",
      "custodyWallet": "0xD5ab...",
      "vaultCycleStatus": "minted",
      "depositedByUserId": "uuid",
      "recipientUserEmail": "user@example.com",
      "recipientUserName": "John",
      "recipientPrimaryWallet": "0xUserWallet...",
      "hasActiveListing": false,
      "burnedAt": null
    }
  ]
}
```

### PATCH /:tokenId

Update registry display fields.

**Body:** `{ displayImageUrl?, displayName?, collectionKey? }`

### POST /:tokenId/preview-metadata-image

Fetch the default image from on-chain IPFS metadata.

### POST /:tokenId/deliver

Transfer custody-held NFT to the vault depositor's primary linked wallet.

**Body:** `{ recipientAddress?: string | null }` — defaults to depositor's primary wallet; if provided, must be linked to depositor's account.

**Response:** `{ txHash: "0x...", recipientAddress: "0x..." }`

**Pre-conditions:**
- Token must be owned by custody wallet on-chain
- Token must have a vault cycle with `depositedByUserId`
- No active listing
- Not already burned

### POST /:tokenId/burn

Permanently burn RWA token on-chain (adminBurn). Called after redemption is verified.

**Response:** `{ txHash: "0x...", cancelledOrderHashes: ["0x..."] }`

**Pre-conditions:**
- Not already burned in DB

**Side effects:**
- Cancels any active marketplace orders for this token (listing/bids on the same tokenId)
- Calls `VaultService.completeRedemptionBurn()` — sets cycle to `redeemed`, `vault_redemptions.burned_at`

### GET /roles/overview

TokenableRWA AccessControl summary for the active chain.

**Response:** `{ chainId, contractAddress, adminSignerAddress, adminSignerHasDefaultAdmin, roles[] }`

### GET /roles/status?wallet=0x…

On-chain role flags for a wallet (`hasRole` per role).

### POST /roles/grant

**Body:** `{ "walletAddress": "0x…", "role": "minter" | "burner" | "pauser" | "default_admin" }`

**Response:** `{ txHash, role, walletAddress }`

Submits on-chain `grantRole` signed by `RWA_ADMIN_PRIVATE_KEY` (must hold `DEFAULT_ADMIN_ROLE`).

### POST /roles/revoke

Same body/response as grant. Submits on-chain `revokeRole`.

### POST /redemptions/:redemptionId/confirm-release

Ops confirms physical asset has been shipped/released from the vault.

**Response:** Updated `VaultRedemption` row.

**Side effects:** Sets `vault_redemptions.status = 'completed'`, `completed_at`

### GET /vault-history/:certNumber

Full deposit/redeem audit history for a physical asset (PSA cert).

**Response:** Array of cycle summaries with token references.

---

## Users

**Base:** `/api/marketplace/admin/users`

**Admin UI:** `/marketplace/admin/users` (Korean table) → detail `/marketplace/admin/users/:id`. Partner approve from user detail uses `POST /marketplace/admin/partners` (wallet-keyed; no `userId` on partners). Strike / restrict / suspend controls are UI stubs only.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats` | Counts incl. `kycApproved` / `kycPending` / `kycRejected` / `kycNone` |
| GET | `/` | List — `filter` (KYC / privy / …), `role=partner\|individual`, `accountStatus=all\|active\|restricted\|suspended` (restricted/suspended → empty), search email/name/Privy/wallet. Each item includes `role`, `partner`, `custodyCardCount`, `accountStatus`, `strikeCount` |
| GET | `/:id` | Detail — same enrichment + wallets, auth providers, KYC fields + `kycEvents` |
| PATCH | `/:id` | Display name / email verified |
| POST | `/:id/kyc` | Admin KYC override `{ status, reason? }` — writes `user_kyc_events` (`source: admin`) |
| DELETE | `/:id` | Delete user |
| POST | `/:id/force-verify-email` | Mark `email_verified` |
| POST | `/:id/wallets` | Admin link wallet |
| DELETE | `/:id/wallets/:address` | Unlink wallet |
| DELETE | `/:id/watchlist/:collectionKey` | Remove watchlist item |

Removed legacy admin tools: password reset, set password, resend verification email, clear pending tokens.

---

## Collection review + covers

These routes live on `CollectionsController` (not under `/admin/*` path prefix) but require the same admin session cookie (except public list).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/marketplace/collections?reviewStatus=` | Public: always `active`. Admin: `pending_review` \| `active` \| `rejected` \| `all` |
| GET | `/api/marketplace/collections/admin/review-counts` | Admin counts by status |
| POST | `/api/marketplace/collections/admin/create-from-cert` | Create catalog collection from PSA cert (no mint/ask). Body `{ certNumber }`. Resolves Cardhedger `card_id` into `components.cardhedgerCardId` (cert lookup + search fallback) and catalog image → S3 when configured. Starts `pending_review`. |
| POST | `/api/marketplace/collections/:key/admin/review` | Set `{ reviewStatus }` |
| POST | `/api/marketplace/collections/:key/admin/cover` | External URL → ingest/overwrite S3 → persist public URL |
| POST | `/api/marketplace/collections/:key/admin/cover/upload` | Multipart `file` → overwrite stable S3 key → persist public URL |
| POST | `/api/marketplace/collections/:key/admin/cover/from-token` | Resolve cover from RWA token metadata (save ingests to S3) |

New collections start as `pending_review` on first ask **or** admin `create-from-cert`. Create-time cover is ingested to S3 when a catalog image is available. Catalog-only rows (no orders / `rwa_tokens`) still appear in Markets after Approve. See [catalog-cover-s3.md](../guides/catalog-cover-s3.md) and BR-11b.

---

## Analytics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/analytics` | Platform analytics overview |
| GET | `/analytics/ga4` | GA4 data via service account |

---

## Partners (Self vault + consignment)

**Controllers:**
- Admin: `backend/src/marketplace/partners/partners-admin.controller.ts` — `/api/marketplace/admin/partners`
- Public: `backend/src/marketplace/partners/partners-public.controller.ts` — `/api/marketplace/partners`

Register company wallets for **Self vault** eligibility and optional partner bulk mint/list. Private keys are optional at create (Self vault only). When present they are AES-256-GCM encrypted with `PARTNER_WALLET_ENCRYPTION_KEY` and **never** returned. Portfolio/listing chips show `{displayName} vault` only for `self_vault_hold` tokens (via `rwa_tokens.vault_partner_id`). PSA-vaulted tokens (`settlement_policy = standard`) show **PSA Vault** even when the owner is a partner.

Ops can also approve a user as partner from **Users → detail → 파트너 승인** (same `POST` create; wallet must be unique). Revoke uses `PATCH isActive: false`.

| Env | Required | Purpose |
|-----|----------|---------|
| `PARTNER_WALLET_ENCRYPTION_KEY` | When storing/using a partner PK | AES-256-GCM master key — `openssl rand -hex 32` |

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/marketplace/admin/partners` | List partners (`hasPrivateKey`, `hasCompanyAddress`, no key material) |
| GET | `/api/marketplace/admin/partners/:id` | Get partner |
| GET | `/api/marketplace/admin/partners/:id/company-address` | Partner company / Partner vault Origin address |
| PUT | `/api/marketplace/admin/partners/:id/company-address` | Upsert company Origin (FedEx ship-from; same SoT as partner Settings) |
| POST | `/api/marketplace/admin/partners` | Create `{ displayName, walletAddress, privateKey?, isActive? }` |
| PATCH | `/api/marketplace/admin/partners/:id` | Update display name / active / add or rotate `privateKey` |
| GET | `/api/marketplace/partners/me` | JWT — partner session + company address status |
| GET / PUT | `/api/marketplace/partners/me/company-address` | JWT — get / upsert Origin address (active partner only) |
| GET | `/api/marketplace/partners/self-vault-eligibility?wallet=` | `{ eligible, isPartner, hasCompanyAddress, partnerId, displayName, vaultLabel }` — `eligible` requires company address |

Company Origin columns live in `marketplace_partner_addresses` (1:1 with `marketplace_partners`). Country is ISO 3166-1 alpha-2. `region` required for US/CA. Used later as FedEx Rate **shipper** when buyers redeem Self vault cards.

**Existing DB:** `add_marketplace_partners.sql`, then `alter_marketplace_partners_optional_pk.sql` + `add_rwa_tokens_vault_partner_id.sql` if upgrading; for addresses apply `add_marketplace_partner_addresses.sql`.

---

## FedEx Rate probe (admin / Swagger)

**Controller:** `backend/src/rwa/admin/fedex-rate-admin.controller.ts`  
**Base:** `/api/marketplace/admin/fedex`

Live sandbox/production Rate call using `FEDEX_*` env. Returns OAuth status, the exact POST body we send, raw FedEx JSON, and the quote redeem would pick (cheapest **ACCOUNT** rate when available, else **LIST**; soft stub fallback). Origin/destination must be ISO-2 (no phone inference). Does **not** return client secret.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/rate-probe` | Admin session required. Body: `origin`, `destination`, `destinationBucket` (`us`/`ca`/`intl`), optional `packageCount` |

Swagger tag: `marketplace-admin-fedex` — examples **US→KR** (expect `fedex_rate`), **US→US**, **KR→KR** (rejected — no stub quote; Korea domestic Partner shipping unsupported).

Requires `FEDEX_RATE_ENABLED=true` and `FEDEX_CLIENT_ID` / `FEDEX_CLIENT_SECRET` / `FEDEX_ACCOUNT_NUMBER` (+ optional `FEDEX_API_BASE_URL`).

---

## Partner bulk mint & list

**Controller:** `backend/src/rwa/admin/bulk-mint-admin.controller.ts`  
**Base:** `/api/marketplace/admin/bulk-mint`

Excel/CSV **certNumber + price** → **prepare** (PSA + IPFS) → **one approve** (`commit`) → `mintBatch` chunks of **50** to the **partner company wallet** (max **500**), then server-signed Seaport asks. Markets show the partner display name; USDC fills go to that wallet. Job GET derives **Listed / Sold** from `orders.status`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/jobs` | List recent jobs (`?partnerId=&limit=`) |
| POST | `/jobs` | Create from JSON `{ partnerId, items:[{certNumber,price}] }` / `csvText` or multipart `file` + `partnerId` |
| GET | `/jobs/:id` | Job + items (incl. `saleStatus`: listed/sold/…) — never returns partner private key |
| GET | `/inventory?partnerId=` | Cross-job inventory for a partner (Listed/Sold) |
| POST | `/jobs/:id/prepare` | Re-run prepare for `pending` / `prepare_failed` items |
| POST | `/jobs/:id/commit` | Mint ready items to partner + list asks (async; poll GET) |
| POST | `/jobs/:jobId/items/:itemId/cancel-listing` | Cancel active ask; item becomes `list_failed` for re-list |

**Job statuses:** `pending` → `preparing` → `ready_to_commit` → `committing` → `completed` (or `failed` / partial `ready_to_commit` for retry).

**Item statuses:** `pending` · `preparing` · `ready` · `minting` · `minted` · `listed` · `prepare_failed` · `mint_failed` · `list_failed` · `skipped`

Prepare downloads each PSA slab once → IPFS (`metadata.image`) + S3 (`slab_display_image_url` on the item, then `rwa_tokens.display_image_url` at commit). If S3 ingest fails, prepare still succeeds when IPFS upload works (`slab_display_image_url` null). If PSA has no slab image, the item becomes `prepare_failed`.

**Example (JSON):**

```bash
curl -X POST "$API/marketplace/admin/bulk-mint/jobs" \
  -H "Cookie: marketplace_admin_session=…" \
  -H "Content-Type: application/json" \
  -d '{
    "partnerId": "…uuid…",
    "items": [
      { "certNumber": "83179580", "price": "1250" },
      { "certNumber": "84956785", "price": "980.50" }
    ]
  }'
```

**Existing DB:** apply `add_marketplace_partners.sql` then `add_bulk_mint_tables.sql`. If upgrading from custody-recipient bulk mint, use `migrate_bulk_mint_to_partner_list.sql`. For S3 slab URLs on job items: `add_bulk_mint_slab_display_image_url.sql`.

---

## RWA slab display images (backfill)

**Controller:** `backend/src/rwa/admin/rwa-slab-admin.controller.ts`  
**Base:** `/api/marketplace/admin/rwa-slab`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/backfill-display-images` | Copy slab images to S3 for `rwa_tokens` missing `display_image_url` (reads IPFS metadata for HTTPS source) |

Body: `{ "limit": 50, "dryRun": false }` (optional; `limit` 1–500, default 50).

Per-row outcomes: `updated` · `skipped` (`no_cert_number`, `no_token_uri`, `no_https_image_source`, `s3_not_configured`) · `failed` (`metadata_fetch_failed`, `s3_ingest_failed`) · `dry_run`. Safe to re-run.

```bash
curl -X POST "$API/marketplace/admin/rwa-slab/backfill-display-images" \
  -H "Cookie: marketplace_admin_session=…" \
  -H "x-tokenable-chain-id: 84532" \
  -H "Content-Type: application/json" \
  -d '{"limit": 100, "dryRun": true}'
```

---

## Redeems (custody / refund ops)

**Controller:** `redeems-admin.controller.ts`  
**Base:** `/api/marketplace/admin/redeems`  
**Auth:** Admin session (`assertAdminSession`)

Lists `vault_redemptions` joined to `vault_cycles` + `rwa_tokens` (tokenId, cert, display name). Each row includes computed `paymentStatus` (`unpaid`|`paid`|`refunded`), `custodyStatus` (`pending`|`in_custody`|`returned`|`n/a`), and `shippingStatus` (`pending`|`tracked`|`released`).

**Refund gate:** blocked when any row in the batch has a non-empty `tracking_number`, or `status` ∈ `burned` | `vault_release_pending` | `completed`. USDC refunds use stored `payment_received_usdc_micros` (never fee recompute) via `PlatformFeeWalletService.transferUsdc`. NFT return uses `RwaChainWriterService.safeTransferFromCustody` → `owner_wallet_address`. Chain: `row.chainId` or default (v1 Sepolia `11155111`).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List redeems (`?status=&paymentBatchId=&limit=`) |
| GET | `/batches/:batchId` | All cards in a payment batch |
| PATCH | `/batches/:batchId/memo` | Body `{ memo }` — same memo on every row in the payment batch (UI: one order) |
| PATCH | `/batches/:batchId/tracking` | Body `{ shipmentKey, trackingNumber, trackingCarrier? }` — tracking for **one vault shipment** (`psa_vault` or `partner:<id>`); locks refunds for the order. Same tracking # may be re-sent to **update carrier** |
| PATCH | `/:id/memo` | Body `{ memo }` — single-row memo (solo / fallback) |
| PATCH | `/:id/tracking` | Body `{ trackingNumber, trackingCarrier? }` — single-row tracking (carrier updatable after number is set) |
| POST | `/batches/:batchId/refund-usdc` | One PLATFORM_FEE USDC transfer of recorded micros to first row’s owner; idempotent if already `usdc_refunded`/`fully_refunded`. Status → `refunded` when NFT already returned or never in custody; else `refundStatus=usdc_refunded` |
| POST | `/:id/return-nft` | Custody → owner NFT transfer; requires `in_custody` or `custody_at` |
| POST | `/batches/:batchId/refund-full` | `refund-usdc` then return every NFT still in custody |
| POST | `/purge-all` | **Dev/staging only** (`NODE_ENV !== production`). Body `{ confirm: "DELETE_ALL_REDEEMS" }`. Deletes all `vault_redemptions` + `vault_redeem_payment_claims`; resets `vault_cycles` stuck in `redemption_requested`/`redeemed` → `minted`; clears `rwa_tokens.burned_at` / `burn_tx_hash` (DB only — on-chain state unchanged). |

Requires `add_vault_redemptions_custody_refund.sql` applied. Does not change FedEx / rating paths.

**UI:** `/marketplace/admin/redeems` — **one payment batch = one order** (per-vault tracking + carrier / memo / USDC refund; per-card Return NFT list).

---

## Vault submissions (sell-flow ops)

**Controllers:** `vault-submissions-admin.controller.ts` + `vault-submission-admin-mint.controller.ts`  
**Base:** `/api/marketplace/admin/vault-submissions`  
**UI:** `/marketplace/admin/vault/submissions` · `/marketplace/admin/vault/psa-mail` · `/marketplace/admin/vault/mint-queue`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/counts` | Pipeline status counts (`all`, `draft` legacy, `awaiting_shipment`, `in_transit`, `psa_reviewing`, `completed`, `cancelled`) |
| GET | `/arrival-reviews` | PSA Items Received mail queue (`?status=pending\|confirmed\|dismissed`). Response includes `confirmedVia` (`auto` \| `admin`), `skippedPublicIds`, `ingestNote` when parse incomplete |
| POST | `/arrival-reviews/test-inject` | **TEST** inject Items Received into Gmail + poll (`PSA_RECEIVED_MAIL_TEST_INJECT=1`). Body: `{ cert, cardLabel? }` |
| POST | `/arrival-reviews/:reviewId/confirm` | Manual confirm → mark matched packages arrived (`psa_reviewing`); sets `confirmedVia=admin` |
| POST | `/arrival-reviews/:reviewId/dismiss` | Dismiss without status change |
| GET | `/mint-queue` | Flat list of cards at PSA (`reviewing`/`approved` on `psa_reviewing` packages). `?q=` |
| GET | `/vaulted-reviews` | Items Vaulted (secured) mail audit (`?status=pending\|minted\|failed\|dismissed`). Includes `mintedVia`, `mintResults` |
| POST | `/vaulted-reviews/test-inject` | **TEST** inject vaulted Gmail + poll/auto-mint (`PSA_VAULTED_MAIL_TEST_INJECT=1` or `PSA_RECEIVED_MAIL_TEST_INJECT=1`) |
| POST | `/vaulted-reviews/:reviewId/mint` | Manual mint & deliver for a vaulted review |
| POST | `/vaulted-reviews/:reviewId/dismiss` | Dismiss without minting |
| POST | `/:idOrPublicId/items/:itemId/mint-and-deliver` | PSA analyze → IPFS → custody mint → deliver to depositor wallet (requires `x-tokenable-chain-id`). Item → `completed` / Live. If cert already has open `minted` cycle on chain, adopts existing token (no remint; may return `adoptedExisting`). Image fallback: PSA front → Cardhedger mint → item → Cardhedger catalog (collection-cover path) → Tokenable logo |
| GET | `/` | List submissions (`?status=&q=` — public id, email, name, cert) |
| GET | `/:idOrPublicId` | Detail + user email/name + items |
| POST | `/:idOrPublicId/arrived` | Package arrived at PSA → `psa_reviewing`; cards `in_transit`/`confirmed` → `reviewing` |
| PATCH | `/:idOrPublicId/status` | Set package status `{ status }` |
| PATCH | `/:idOrPublicId/items/:itemId` | Set card status `{ status, rejectionReason? }` |

User-facing JWT API: [vault-submissions.md](./vault-submissions.md).

---

## Self-vault payouts

**Controller:** `self-vault-settlement.controller.ts` (under `/api/marketplace/admin/…`)  
**UI:** `/marketplace/admin/self-vault-payouts`  
**Chain:** list is scoped by `x-tokenable-chain-id`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/self-vault-settlements` | Ledger rows (`?status=pending_confirm\|confirmed\|paid\|rejected`) |
| POST | `/self-vault-settlements/:id/confirm` | Ops confirm (skip buyer) → `confirmed` |
| POST | `/self-vault-settlements/:id/reject` | Reject |
| POST | `/self-vault-settlements/:id/execute-payout` | Send `seller_payout_usdc` from `PLATFORM_FEE_PRIVATE_KEY` wallet (auto-confirms if pending) → mark `paid`. Cron also auto-pays ~5 min after fulfill. |
| POST | `/self-vault-settlements/backfill-missing` | Create ledger rows for fulfilled self-vault asks missing a settlement (repair) |

Created when a `self_vault_hold` ask is fulfilled. Seller net ≈ gross × (1 − `PLATFORM_FEE_BPS`/10000). Auto payout cron: `SELF_VAULT_AUTO_PAYOUT_CRON` / `SELF_VAULT_AUTO_PAYOUT_DELAY_SECONDS` (default 300). See [self-vault-hold-settlement.md](../architecture/self-vault-hold-settlement.md).

---

## Platform analytics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/analytics` | KPI dashboard — users, orders, funnel, timeseries (mints/orders/GMV/holdings scoped by `x-tokenable-chain-id`) |
| GET | `/analytics/ga4` | GA4 traffic (when configured) |
| GET | `/data-inventory` | Accumulated PostgreSQL stores — row counts, date ranges, per-table metadata |

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `MARKETPLACE_ADMIN_USERNAME` | Admin console login (default: `skyand`) |
| `MARKETPLACE_ADMIN_PASSWORD` | Admin console password (default: `071725`) |
| `MARKETPLACE_ADMIN_SESSION_SECRET` | HMAC secret for admin session cookie |
| `MARKETPLACE_ADMIN_SESSION_SECONDS` | Admin session TTL (default: 86400) |
| `AWS_REGION` / `CATALOG_COVER_S3_*` / `CATALOG_COVER_PUBLIC_BASE_URL` | Catalog cover S3 upload ([catalog-cover-s3.md](../guides/catalog-cover-s3.md)) |
| `RWA_OWNER_PRIVATE_KEY` | Signs mint and adminBurn transactions |
| `RWA_ADMIN_PRIVATE_KEY` | Signs grantRole/revokeRole (must hold DEFAULT_ADMIN_ROLE on-chain; dev fallback: DEPLOYER_PRIVATE_KEY) |
| `RWA_CUSTODY_PRIVATE_KEY` | Signs custody delivery transfers |
| `RWA_CUSTODY_WALLET_ADDRESS` | Custody wallet address |
