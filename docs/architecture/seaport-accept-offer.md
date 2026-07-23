# Seaport Accept Offer (Seller UX)

ADR for Vault/Seaport: sellers accept a specific token offer **without** lowering their public ask.

**Status:** Shipped (Phases B–F)  
**Last updated:** 2026-07-23  
**Channel:** Vault / Seaport only (not P2P escrow)

---

## Decision

Sellers keep their ask as-is and **accept a specific incoming token offer**. Settlement is Seaport approval-based and atomic (`matchAdvancedOrders` and/or bid `fulfillOrder` as implemented in Phase B). Bid USDC is **not** escrowed in advance.

**Rejected:** “Change price / re-list lower to match a bid” as the primary seller path — that publishes a discount to the open book (sniping) and can leave the seller with a lowered ask if the buyer cannot pay.

---

## Example (canonical)

| Step | State |
|------|--------|
| 1 | Seller lists ask **40 USDC** (active) |
| 2 | Buyer places token offer **38 USDC** on that `tokenId` |
| 3 | Platform notifies the wallet with an **active ask on that `tokenId`** |
| 4 | Seller taps notification CTA **Accept offer** |
| 5 | App opens **Portfolio → My Assets** with Accept offer modal (`acceptBid`, `tokenId`, optional `askHash`) |
| 6 | Modal shows reference ask **40** and offer **38**; seller taps **Confirm trade** |
| 7a Success | On-chain settle at **38**; NFT transfers; **40 ask ends** (fulfilled/cancelled as part of sale) |
| 7b Failure | Tx reverts or preflight fails (buyer USDC/allowance); **40 ask unchanged**; **38 bid invalidated** so others do not retry the same dead offer |

---

## Product rules (locked)

### Offer type (P0)

- **In scope:** card-level **token offers** (`tokenId` specific), per BR-8a.
- **Out of scope for first ship:** collection criteria / Merkle bids (Phase 6+ if needed).

### Who gets notified

- Recipients: wallets/users with an **active Seaport ask** on the **same `tokenId`** as the new bid.
- **Not** every seller in the collection (avoids noise and wrong accept targets).

### CTA deep link

Locked query params (Portfolio My Assets → Accept offer modal):

- `acceptBid=<bidOrderHash>` (required)
- `tokenId=<id>` (required)
- `askHash=<askOrderHash>` (optional, when known)

Notification CTA label: **Accept offer**. Tapping opens the deep link and auto-opens the Accept offer modal when params are valid.

### Accept modal

- Shows: asset identity, **current ask price** (reference), **offer price**, buyer short wallet, primary **Confirm trade** CTA.
- Confirm does **not** re-sign a new ask at the offer price.
- Pre-flight: buyer USDC balance + Seaport USDC allowance; block CTA if insufficient.

### Ask immutability on failure

- On failed accept: **do not** cancel, replace, or reprice the seller’s ask.
- On success: ask is cleared because the NFT is sold (existing fulfill / cancel-sibling behavior).

### Dead offer handling

- If settle fails because the buyer is unfunded / allowance revoked / order no longer fillable: mark that bid **invalidated or cancelled** in `orders` so other sellers do not hit the same failure.
- Invalidation is idempotent by `order_hash`.
- API: `PATCH /api/marketplace/orders/:hash/invalidate-dead-bid` (on-chain underfunded/expired check).

### List / Change price

- **Change price** remains for genuine ask edits only — not the path to take a lower bid.
- Optional post-list instant match when a **same-price** bid already exists may remain, but must not require publishing a discount to hunt a lower bid.
- Sell ticket copy must not instruct “lower your ask to match this bid.”

---

## Technical anchors

| Piece | Location |
|-------|----------|
| Accept token offer (ask untouched) | `frontend/lib/seaport/fulfillment/acceptTokenOffer.ts` |
| Buyer USDC preflight | `checkBuyerUsdcReadyForBid` in `runCriteriaMatch.ts` |
| Dead-bid invalidate API | `PATCH /api/marketplace/orders/:hash/invalidate-dead-bid` |
| Bid → ask-owner notifications | `marketplace_notifications` + `NotificationsService.notifyAskOwnerOfTokenBid` |
| Notifications inbox API | `GET /api/marketplace/notifications` (JWT) |
| Token offer + listing match | `frontend/lib/seaport/fulfillment/runCriteriaMatch.ts`, `criteriaMatch.ts` |
| Matched pair API | `POST /api/marketplace/orders/fulfill-matched-pair` |
| Bid fulfill clears sibling asks | `OrdersService.fulfillOrder` (token bid path) |
| Orders book | `orders` table / marketplace orders API |
| Portfolio Accept modal + deep link | `usePortfolioAcceptOffer`, `PortfolioAcceptOfferModal`, `/portfolio?acceptBid=&tokenId=` |
| Notifications UI | `NotificationsDrawer` + `useMarketplaceNotifications` |
| RQ invalidation | `invalidateAfterAcceptOffer`, `invalidateAfterDeadBid`, `invalidateMarketplaceNotifications` |

P2P (`TokenablePaymentEscrow`) is **out of scope**.

---

## Implementation phases

| Phase | Focus | Status |
|-------|--------|--------|
| **B** | Accept core (ask untouched); Portfolio Accept modal; deep link; wallet E2E 40/38 | Done |
| **C** | Pre-flight balance/allowance; dead-bid invalidate on failure | Done |
| **D** | Persist + deliver bid notifications to ask owners | Done |
| **E** | Notification CTA polish; remove lower-to-match UX | Done |
| **F** | Docs sync, invalidation, regression | Done |

---

## Regression checklist

Manual / smoke:

1. List ask **40** → place token bid **38** → ask owner sees inbox **Accept offer** (not all collection sellers).
2. Collection Offers book shows the **38** token bid (not criteria-only).
3. CTA → `/portfolio?acceptBid=…&tokenId=…` → modal opens; **Confirm trade** settles; ask cleared; NFT to bidder.
4. Buyer with insufficient USDC / allowance → preflight blocks CTA; bid invalidated; **ask still 40**.
5. Sell ticket / Change price copy does **not** tell sellers to lower ask to match a lower bid.
6. After accept or dead-bid invalidate, orders + portfolio + notifications caches refresh (`invalidateAfterAcceptOffer` / `invalidateAfterDeadBid`).

Automated:

- `backend` / `frontend` `tsc --noEmit`
- `pnpm exec jest src/marketplace/notifications/notifications.service.spec.ts`
- `pnpm exec jest src/marketplace/utils/platform-tape.util.spec.ts`

---

## Non-goals

- New escrow or new marketplace protocol for Vault trades
- Holding bidder USDC until accept
- Notifying all collection listers for every token offer
- Replacing Seaport with Boson/Cyfrin for this flow
