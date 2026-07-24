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

**Admin UI:** `/marketplace/admin/users` — compact stats + filters (Privy, wallet, KYC states). Expanded row: identity (Privy/Google/password flag), KYC/Sumsub (applicant id, reject reason, event log, approve/reject/reset), auth providers, wallets (source/client/connector/Privy wallet id), watchlist, delete.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats` | Counts incl. `kycApproved` / `kycPending` / `kycRejected` / `kycNone` |
| GET | `/` | List — filters: `privy`, `with_wallet`, `kyc_approved`, `kyc_pending`, `kyc_rejected`, `kyc_none`, `legacy`, …; search email/Privy/wallet/applicant id |
| GET | `/:id` | Detail — wallets, auth providers, KYC fields + `kycEvents` |
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
| POST | `/api/marketplace/collections/:key/admin/review` | Set `{ reviewStatus }` |
| POST | `/api/marketplace/collections/:key/admin/cover` | External URL → ingest/overwrite S3 → persist public URL |
| POST | `/api/marketplace/collections/:key/admin/cover/upload` | Multipart `file` → overwrite stable S3 key → persist public URL |
| POST | `/api/marketplace/collections/:key/admin/cover/from-token` | Resolve cover from RWA token metadata (save ingests to S3) |

New collections start as `pending_review` on first ask; create-time cover is ingested to S3 when configured. See [catalog-cover-s3.md](../guides/catalog-cover-s3.md) and BR-11b.

---

## Analytics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/analytics` | Platform analytics overview |
| GET | `/analytics/ga4` | GA4 data via service account |

---

## Partners (consignment wallets)

**Controller:** `backend/src/marketplace/partners/partners-admin.controller.ts`  
**Base:** `/api/marketplace/admin/partners`

Register company wallets entrusted to Tokenable. Private keys are AES-256-GCM encrypted with `PARTNER_WALLET_ENCRYPTION_KEY` (32-byte hex) and **never** returned from the API.

| Env | Required | Purpose |
|-----|----------|---------|
| `PARTNER_WALLET_ENCRYPTION_KEY` | Yes (for partners/bulk mint) | AES-256-GCM master key — `openssl rand -hex 32` |

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List partners (no key material) |
| GET | `/:id` | Get partner |
| POST | `/` | Create `{ displayName, walletAddress, privateKey, isActive? }` |
| PATCH | `/:id` | Update display name / active / rotate `privateKey` |

**Existing DB:** `backend/sql/maintenance/add_marketplace_partners.sql`

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

**Existing DB:** apply `add_marketplace_partners.sql` then `add_bulk_mint_tables.sql`. If upgrading from custody-recipient bulk mint, use `migrate_bulk_mint_to_partner_list.sql`.

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
