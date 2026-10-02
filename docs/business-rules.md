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
- **Enforced at:** Backend `VaultService.reserveCycleForDeposit()` — rejects if open cycle exists. UI pre-flight: `GET /api/rwa/cert-availability/:certNumber` (mint form + sell flow) blocks Mint / add-cert before upload.
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
- **Self-vault hold** (partner vault) asks encode **seller USDC + platform fee** on Seaport (`SELF_VAULT_PLATFORM_FEE_BPS`, default **10%** = $10 on a $100 sale to the fee wallet)

### BR-8c: Self-Vault Hold Settlement

Partner-vault tokens (`settlement_policy = self_vault_hold`) use the **same instant on-chain split** as PSA vault, with a higher fee:

1. **Ask consideration** — USDC to seller (net) + USDC to `PLATFORM_FEE_RECIPIENT` (fee bps, default 10%)
2. **On fulfill** — NFT → buyer; USDC → seller + fee wallet (no delayed hold for new listings)
3. **Legacy ledger** — fulfilled asks that still used **100% → fee wallet** create `self_vault_settlements` for off-chain seller payout (admin or cron). New split asks skip the ledger.
4. **Bid-only fulfill** is **blocked** for these tokens — match bid+ask on Seaport or list an ask

### BR-8a: Offers (Bids)

Collection **Place a Bid** is a **criteria collection offer** (Seaport itemType 4): USDC for any minted copy in that bucket’s Merkle set. Card-level **token offers** (specific `tokenId`, itemType 2) still exist (token page / replace of an existing token bid).

- Collection **Offers** order book includes active token offers and collection criteria bids
- Max **1 active offer** per wallet per `collectionKey` is **not** the default (`MARKETPLACE_MAX_ACTIVE_BIDS_PER_OFFERER=0` means unlimited)
- Offers expire after a buyer-chosen window of **1, 3, 7, 14, 30, 60, 90, or 180 days** (Seaport `endTime`). Default is **7 days**.
- Collection Place Bid works with or without an active ask, including catalog-only collections (admin create-from-cert, no mint yet). An empty Merkle set is signed with a sentinel leaf so the bid can rest on the book. That bid cannot fill until the buyer re-places after the first copy is minted (Seaport binds the root at sign time; wildcard criteria is not used — it would match any RWA on the contract). Listing the first copy does not fail instant-match because of those pending bids.
- A bid that is **≥ the collection’s live lowest ask** switches the Bid tab CTA to **Buy now** (`BID_CROSSES_ASK`), including the bidder’s own listing. Buy now **fulfills the ask at the listing price** (not the typed bid). The listing wallet must still own the NFT on-chain; stale asks are dropped from the book.
- If the connected buyer **already** `ownerOf` the NFT, Buy now must not look like a failed sale: remove the stale ask, heal `owner_wallet`, and tell the user they already own it. A successful fulfill receipt still settles the book even when `getOrderStatus` misses.
- A **reverted** `fulfillOrder` / `matchAdvancedOrders` tx must not mark the ask fulfilled or rewrite `owner_wallet`. `PATCH …/orders/:hash/fulfill` requires Seaport filled **or**, for asks, `ownerOf` already equal to the buyer. List from the wallet that `ownerOf` returns; a leftover ask from another wallet is cancelled so the true owner can list.
- When offer price equals ask, match candidates are ordered **FIFO** by `createdAt` within that price
- Frontend checks USDC balance before submit; Add Funds when short
- A new mint after a criteria bid was signed changes the Merkle root — that bid cannot fill the new copy until the buyer re-places the bid. The same applies when the first mint replaces a catalog sentinel root. Listing an **already minted** copy does not change the root.

### BR-8b: Take Token Offer (Edit price primary)

Sellers take a resting offer primarily by **Edit price / list** (set ask → instant match). Accept-offer without re-signing the ask remains a secondary path.

- Seaport bids are **FULL_OPEN** with a fixed USDC offer that must be fully consumed. Listing **below** a fillable bid signs the ask **at the bid USDC** (seller price improvement) so `matchAdvancedOrders` does not revert on leftover offer amount.
- Collection Sell of any minted copy can fill a **criteria** collection bid. A **token** offer only fills that `tokenId`.

- Settlement is Seaport atomic fill/match; bid funds are not escrowed in advance
- **Edit price → instant match fails** because the buyer is unfunded (USDC balance/allowance): **keep the ask at the price just set**; invalidate the dead bid (`invalidate-dead-bid`). Instant-only auto-cancel does not apply for those funding failures. Ask owner and bidder both get inbox notifications.
- **Accept-offer fails** (buyer unfunded): leave the **existing** ask active and **unchanged**; invalidate the dead bid (same notifications)
- Successful fill clears the ask because the NFT is sold
- Notifications for new bids target owners of an **active ask on that `tokenId`**, not all collection sellers
- **Edit price** on My Assets / Certificate must show the **new** ask immediately (React Query + paint-time `ordersAsk` cache). Do not keep the previous listing price after a successful replace.
- Spec: [seaport-accept-offer.md](architecture/seaport-accept-offer.md)

### BR-9: USDC-Only Settlement

All marketplace prices and trades are denominated in **USDC (6 decimals)**.

- No ETH, MATIC, or other currency settlement
- USDC contract address is chain-specific (see env vars)

### BR-10: No Admin Burn Without Redemption Request

The `adminBurn` endpoint does not require a prior `vault_redemptions` row, but the standard ops flow is:

1. User submits `POST /rwa/redeem-batch` (USDC payment + ship-to)
2. Admin verifies, then calls `POST /admin/rwa-tokens/:id/burn`

Admin can burn without a redemption request (emergency cases). The vault cycle state will not have a `vault_redemption` record in that case.

### BR-11: Active Listing Blocks Burn/Deliver

Admin cannot burn or deliver an NFT that has an active Seaport listing.

- Pre-check in `RwaTokenAdminService` before on-chain calls
- **Why:** User must cancel listing first to prevent griefing

### BR-11b: Collections on First Ask (Markets visibility)

A `marketplace_collections` row is created on **first ask listing** (`ensureCollectionForListing`) with `review_status = active` — no admin Approve step. Canceling the ask does **not** delete the collection row.

- Home / Markets / public collection lists only show `review_status = active`
- Admin catalog create (`POST …/collections/admin/create-from-cert`) without a listing still starts as `pending_review` (optional pre-mint catalog)
- Admin may still reject or reopen collections from Marketplace Admin → Collections
- Collection `coverImageUrl` is not replaced on later listings or sales once it is set. Admin cover upload/URL is the replace path.
- Existing rows default to `active` so legacy catalog stays public

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

- Only the backend hot wallet (`MINTER_ROLE`) submits `mint(to)`. Burns use ERC721Burnable; the backend signs `burn` only when custody (or the minter wallet) owns the token.
- Seaport trading is user-signed (standard ERC-721 transfers via fulfillOrder)

### BR-20: No TokenId Reuse

Smart contract tokenIds are monotonically increasing and never reused.

- OZ `Counters` auto-id; deploy burns token 0 so live inventory starts at 1
- Burned tokens are gone; they receive a new tokenId on re-mint

### BR-21: NFT Changes Are Redeploys

There is no UUPS upgrade. Changing NFT behavior means deploying a new OpenZeppelin preset instance and swapping env addresses. Old tokens remain on the old address.

- `DEFAULT_ADMIN_ROLE` only grants/revokes minter and pauser
- `vaultRef` is a Postgres/vault-cycle key, not contract storage
