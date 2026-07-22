# P2P Payment Escrow

ADR-style notes for Tokenable P2P sell: USDC is held on-chain until buyer confirmation; the RWA NFT stays in platform custody.

**Status:** Implemented (MVP phase 1)  
**Last updated:** 2026-07-22

---

## Decision

Use a **thin Payment Escrow contract** (OSS pattern: Cyfrin Escrow + multi-id / fee / timeout from marketplace escrow examples). Do **not** adopt a full open-source marketplace.

| Asset | Holder | Mechanism |
|-------|--------|-----------|
| RWA NFT | Platform custody wallet | Existing `mint` / `adminBurn` via `RwaChainWriterService` |
| USDC | `TokenablePaymentEscrow` | Buyer `createAndDeposit` → `confirmReceipt` / arbiter `refund` / `settleAfterTimeout` |

Vault listings continue to use **Seaport**. P2P Buy never uses Seaport (atomic fill conflicts with delayed settlement).

---

## On-chain policy (fixed)

| Rule | Value |
|------|--------|
| Platform fee | 5% (500 bps) of escrowed USDC, paid to treasury on release |
| Escrow key | `keccak256("tokenable:p2p:" + listingId)` — one slot per listing |
| Buyer confirm | Anytime while `Funded` |
| Auto-release | `settleAfterTimeout` after `autoReleaseAt` (set at deposit; MVP default **7 days** from funding) |
| No-ship refund | Backend cron: if still `SOLD` and no tracking **5 business days** → arbiter `refund` + burn NFT |
| Cancel + orphan fund | Seller cancel while listing open but escrow `Funded` → arbiter refund then burn |
| Arbiter | `PAYMENT_ESCROW_ARBITER_PRIVATE_KEY` (falls back to `RWA_OWNER_PRIVATE_KEY` in dev) |
| Order PII | `GET /orders/:id` requires JWT; buyer/seller only |

---

## vaultRef / channel rules

- Same `vaultRef = keccak256(cert.toUpperCase())` as Vault. Contract `activeTokenIdOf` blocks a second live mint for the same cert.
- P2P mint goes to custody and is **never** admin-delivered to the seller.
- P2P custody NFTs must **not** create Seaport asks (`listing_channel = p2p`).
- Cancel listing → immediate `adminBurn` (no admin approval).

---

## NFT settle (MVP)

On successful payment release (confirm or timeout): burn NFT from custody and record buyer in DB history. No intermediate on-chain transfer to buyer (avoids approval/gas complexity). Physical card is the buyer's asset; token was a trade instrument.

---

## State machine (DB)

```
P2P_MINTED_TK → P2P_LISTED → SOLD → SETTLED → CLOSED
                     ↓ cancel
              P2P_CANCELLED → BURNED
SOLD → (arbiter refund) → REFUNDED → BURNED
```

---

## Related code

| Area | Path |
|------|------|
| Contract | `contracts/contracts/TokenablePaymentEscrow.sol` |
| Backend | `backend/src/marketplace/p2p/` |
| Writer | `backend/src/blockchain/payment-escrow-writer.service.ts` |
| SQL | `backend/sql/schema/045_p2p.sql` |
| API | `docs/api/p2p.md` |
