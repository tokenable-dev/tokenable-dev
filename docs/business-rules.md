# Business Rules

Core invariants and business logic that govern the Tokenable platform. These rules must never be violated by implementation changes.

---

## Physical Card Rules

### BR-1: PSA 10 Gate

Only **PSA-graded cards with a numeric grade of 10** may be minted as RWA tokens.

- **Enforced at:** `POST /api/rwa/upload` (400 response if grade ≠ 10)
- **Why:** PSA 10 ("Gem Mint") is the highest grade with the most liquid marketplace
- **Exception:** None — this is a hard business rule

### BR-2: One Active NFT Per Physical Card

At any time, a PSA cert number can have **at most one active (non-burned) NFT** on the platform.

- **Enforced at:** Smart contract `VaultRefAlreadyActive` custom error
- **Enforced at:** Backend `VaultService.reserveCycleForDeposit()` — rejects if open cycle exists
- **Why:** Prevents double-representation of the same physical asset
- **Exception:** After burn, the same cert may be re-minted (new tokenId, new vault cycle)

### BR-3: vaultRef Permanence

The `vaultRef = keccak256(certNumber.toUpperCase().trim())` is permanent and immutable.

- Stored in contract per tokenId, survives burn
- Never changes between cycles of the same physical card
- This is the canonical on-chain identity for the physical asset

---

## Vault Cycle Rules

### BR-4: One Open Cycle Per Asset

A `vault_asset` may have **at most one open vault cycle** at a time (status not in `redeemed`, `cancelled`).

- **Enforced at:** `VaultService.reserveCycleForDeposit()` (DB check + contract check)
- **Why:** Prevents duplicate deposit processes

### BR-5: Mint Delivery Mode

**PSA vault / default mint** lands in the **platform custody wallet**; admin delivers after ops verification.

- Default `POST /api/rwa/mint` → `mint(custodyWallet, tokenURI, vaultRef)`
- Admin must explicitly `deliver` the NFT to the user's wallet
- **Why:** Ops verifies physical card receipt (PSA vault) before NFT delivery

**Self vault** uses `deliveryMode: "direct"` → `mint(userLinkedWallet, …)` so the NFT appears in the minter's portfolio immediately (no admin deliver). Cost basis is seeded the same way as vault deliver. The mint persists `rwa_tokens.settlement_policy = self_vault_hold` (see BR-8c).

### BR-6: Recipient Must Be Linked Wallet

The `recipientAddress` in `POST /api/rwa/mint` must be **a wallet address linked to the authenticated user's account**.

- Verified by `UserService` before minting
- **Why:** Prevents minting on behalf of another user

### BR-7: Redemption Owner Match

At redemption request time, the `ownerWalletAddress` must **currently own the NFT on-chain**.

- Verified by `BlockchainService.getRwaTokenOwner(tokenId)`
- **Why:** Prevents redemption requests from non-owners

---

## Marketplace Rules

### BR-8: Seaport-Only Trading

All marketplace trades use **Seaport 1.5**. There is no relational bid/ask matching system.

- Orders are signed EIP-712 structures, not matched server-side
- Settlement is on-chain (`fulfillOrder` / `matchAdvancedOrders`)
- Platform fee (5% default) is encoded as Seaport consideration item on **asks** only — bids/offers have no bid fee
- **Self-vault hold** asks encode **100%** of USDC to `PLATFORM_FEE_RECIPIENT` (no seller consideration line)

### BR-8c: Self-Vault Hold Settlement (Option A)

Self-vault minted tokens (`settlement_policy = self_vault_hold`) settle differently from standard asks:

1. **Ask consideration** — single USDC item to the platform fee wallet (full listing price)
2. **On fulfill** — NFT → buyer; USDC → company; seller gets **$0 on-chain**
3. **Ledger** — one `self_vault_settlements` row per fulfilled ask (`pending_confirm`), keyed by `order_hash`. Resale of the same token before payout creates an additional row (pay each seller separately).
4. **Seller payout** — admin `execute-payout` any time (auto-confirms if needed), **or** cron auto confirm+payout ~**5 minutes** after that sale’s fulfill (`SELF_VAULT_AUTO_PAYOUT_DELAY_SECONDS`, default 300). Reject skips payout.
5. **Bid-only fulfill** (`fulfill_bid` when offer is below ask) is **blocked** for these tokens — match against a full-platform-take ask instead

### BR-8a: Card-Level Offers (Bids)

Bids are **token offers** on a specific card (`tokenId`), not collection-wide criteria bids.

- Collection **Offers** order book includes active token offers (and any legacy criteria bids still on the book)
- Max **1 active offer** per wallet per `collectionKey` (same collection, any tokenId)
- Offers expire after a buyer-chosen window of **1, 3, 7, 14, 30, 60, 90, or 180 days** (Seaport `endTime`). Default is **7 days**.
- Collection **Place a Bid** works with or without an active ask. Floor listing → that `tokenId`; otherwise a minted token in the collection. If the collection has no vaulted tokens yet, bid is unavailable.
- Unlisted token bids (no active ask on that card) must be at least **70% of the collection market price** (Cardhedger snapshot). Example: $100 market → min $70. There is **no maximum** vs market (a $150 bid on a $100 market is allowed). If market price is unknown, the floor is not applied.
- When offer price equals ask, match candidates are ordered **FIFO** by `createdAt` within that price
- Frontend checks USDC balance before submit; Add Funds when short

### BR-8b: Take Token Offer (Edit price primary)

Sellers take a card-level token offer primarily by **Edit price** (set ask → instant match). Accept-offer without re-signing the ask remains a secondary path.

- Settlement is Seaport atomic fill/match; bid funds are not escrowed in advance
- **Edit price → instant match fails** because the buyer is unfunded (USDC balance/allowance): **keep the ask at the price just set**; invalidate the dead bid (`invalidate-dead-bid`). Instant-only auto-cancel does not apply for those funding failures. Ask owner and bidder both get inbox notifications.
- **Accept-offer fails** (buyer unfunded): leave the **existing** ask active and **unchanged**; invalidate the dead bid (same notifications)
- Successful fill clears the ask because the NFT is sold
- Notifications for new bids target owners of an **active ask on that `tokenId`**, not all collection sellers
- Notification CTA **Edit price** deep-links to `/portfolio?setprice={tokenId}` (opens Set/Edit price drawer)
- Spec: [seaport-accept-offer.md](architecture/seaport-accept-offer.md)

### BR-9: USDC-Only Settlement

All marketplace prices and trades are denominated in **USDC (6 decimals)**.

- No ETH, MATIC, or other currency settlement
- USDC contract address is chain-specific (see env vars)

### BR-10: No Admin Burn Without Redemption Request

The `adminBurn` endpoint does not require a prior `vault_redemptions` row, but the standard ops flow is:

1. User submits `POST /rwa/redeem-request`
2. Admin verifies, then calls `POST /admin/rwa-tokens/:id/burn`

Admin can burn without a redemption request (emergency cases). The vault cycle state will not have a `vault_redemption` record in that case.

### BR-11: Active Listing Blocks Burn/Deliver

Admin cannot burn or deliver an NFT that has an active Seaport listing.

- Pre-check in `RwaTokenAdminService` before on-chain calls
- **Why:** User must cancel listing first to prevent griefing

### BR-11b: New Collections Require Admin Review Before Markets

A new `marketplace_collections` row created on first ask **or** via admin catalog create (`POST …/collections/admin/create-from-cert`) starts as `review_status = pending_review`.

- Sellers may still create/manage asks while pending
- Home / Markets / public collection lists only show `review_status = active`
- Admin approves (`active`) or rejects (`rejected`) from Marketplace Admin → Collections
- Existing rows default to `active` so legacy catalog stays public
- Catalog-only collections (no mint / ask yet) are visible on Markets after Approve — list SQL treats rows with no orders and no `rwa_tokens` as chain-global

---

## Authentication Rules

### BR-12: Privy-Only User Auth

All user-facing authentication goes through **Privy**. Legacy Google OAuth / email-password routes have been removed.

- Admin console uses a separate username/password system
- Privy handles all social logins, passkeys, and embedded wallet creation

### BR-13: KYC Required for Vault Deposits (Sell Access)

Users must have `kyc_status = 'approved'` to access sell/vault features.

- Enforced in frontend `useSellAccessGate`
- KYC gate opens a modal directing users to complete verification
- Internal dev email bypasses KYC check (hardcoded in `accountAccess.ts`)

### BR-14: Wallet Required for Trading

Users must have a **linked wallet** (`user_wallets`) to trade.

- Enforced in frontend `useTradeAccessGate` (level 1)
- Privy embedded wallets are created automatically for all new users

---

## Pricing Rules

### BR-15: Materialized Pricing (No Live Cardhedger on Read)

Collection prices shown to users come from **`collection_market_snapshots`**, not from live Cardhedger API calls.

- Read path: PostgreSQL only
- Write path: async snapshot workers (cron + stale-while-revalidate trigger)
- **Why:** Rate limiting + performance; Cardhedger is expensive per-call

### BR-16: Portfolio Snapshots are Immutable

Daily portfolio snapshots (09:00 KST) are **write-once** — existing rows are never overwritten.

- `PortfolioDailySnapshotService` checks `if today's row exists → skip`
- Historical records remain accurate even if prices change

---

## PSA API Rules

### BR-17: PSA API Rate Limit Management

PSA Public API usage is pooled across `PSA_PUBLIC_API_TOKENS` (comma-separated).

- Tokens blocked for 24h after a 429 error (until next UTC midnight)
- Mint and analyze paths call live `GetByCertNumber` (no `psa_cert_snapshots` DB cache)
- `PsaPublicApiService` keeps a short in-process cache (`PSA_PUBLIC_API_CACHE_TTL_MS`)

### BR-18: PSA Snapshot Freshness

Collection PSA mirror fields live in `marketplace_collections.components` (populated from live API or mint metadata). Cardhedger **market** snapshots use `collection_market_snapshots` — separate from PSA cert lookup.

---

## Contract Rules

### BR-19: Backend-Only On-Chain Writes

Users never call the smart contract directly for mint or burn operations.

- Only the backend hot wallet (MINTER_ROLE, BURNER_ROLE) submits mint/burn transactions
- Seaport trading is user-signed (standard ERC-721 transfers via fulfillOrder)

### BR-20: No TokenId Reuse

Smart contract tokenIds are monotonically increasing and never reused.

- `_nextTokenId` starts at 1 and only increments
- Burned tokens are gone; they receive a new tokenId on re-mint

### BR-21: UUPS Upgrade Requires Admin Role

Smart contract upgrades require the `DEFAULT_ADMIN_ROLE`.

- Cannot upgrade from the minter/burner hot wallet alone
- After upgrade: run `upgrade-tokenable-rwa.ts` to auto-grant any missing roles
- Never change the `vaultRef` storage slot in an upgrade (permanent on-chain data)
