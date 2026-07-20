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

**Admin UI:** `/marketplace/admin/users` — search and filters (All, Privy, With wallet, KYC, Pre-Privy), compact stats, and a **Privy & Add funds** panel (MoonPay readiness via `GET /api/privy/apps/settings`). Expanded user rows show a support snapshot (Privy ID, primary wallet + on-ramp hint, KYC), wallet admin actions, and optional watchlist cleanup. Per-user MoonPay payment history is not stored in Tokenable — use Privy Dashboard → Users.

End-user auth is **Privy-only**. Admin user tools reflect Privy linked accounts (`user_auth_providers`, `user_wallets`).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats` | Privy-centric stats (google, email OTP, wallet login, legacy pre-Privy) |
| GET | `/` | List users — filters: `privy`, `google`, `email`, `wallet`, `legacy`, KYC, wallet |
| GET | `/:id` | User detail — auth providers, wallets, watchlist |
| PATCH | `/:id` | Update display name / email verified flag |
| DELETE | `/:id` | Delete user account |
| POST | `/:id/force-verify-email` | Mark platform `email_verified` flag |
| POST | `/:id/wallets` | Admin link wallet (override) |
| DELETE | `/:id/wallets/:address` | Unlink wallet |
| DELETE | `/:id/watchlist/:collectionKey` | Remove watchlist item |

Removed legacy admin tools: password reset, set password, resend verification email, clear pending tokens.

---

## Analytics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/analytics` | Platform analytics overview |
| GET | `/analytics/ga4` | GA4 data via service account |

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `MARKETPLACE_ADMIN_USERNAME` | Admin console login (default: `skyand`) |
| `MARKETPLACE_ADMIN_PASSWORD` | Admin console password (default: `071725`) |
| `MARKETPLACE_ADMIN_SESSION_SECRET` | HMAC secret for admin session cookie |
| `MARKETPLACE_ADMIN_SESSION_SECONDS` | Admin session TTL (default: 86400) |
| `RWA_OWNER_PRIVATE_KEY` | Signs mint and adminBurn transactions |
| `RWA_ADMIN_PRIVATE_KEY` | Signs grantRole/revokeRole (must hold DEFAULT_ADMIN_ROLE on-chain; dev fallback: DEPLOYER_PRIVATE_KEY) |
| `RWA_CUSTODY_PRIVATE_KEY` | Signs custody delivery transfers |
| `RWA_CUSTODY_WALLET_ADDRESS` | Custody wallet address |
