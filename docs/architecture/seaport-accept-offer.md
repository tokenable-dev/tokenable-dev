# Seaport Accept Offer (Seller UX)

ADR for Vault/Seaport: sellers take a token offer via **Edit price** (primary) or Accept offer (secondary), with clear failure rules for unfunded bids.

**Status:** Shipped (Phases B–F) + funding-fail keep-ask (2026-07-30)  
**Last updated:** 2026-07-30  
**Channel:** Vault / Seaport only (not P2P escrow)

---

## Decision

Sellers can settle against a specific incoming **token offer**. Bid USDC is **not** escrowed in advance.

**Primary path (notification CTA):** seller opens **Edit price**, sets ask to the offer (or another price), and the app attempts instant match.

**Secondary path:** Accept offer settles without first re-signing the ask (`matchAdvancedOrders` / bid fulfill as implemented).

**Rejected as primary:** silently publishing a discount ask *only* to hunt a lower bid without an explicit Edit price / Confirm — that snipes the open book. Explicit Edit price to the bid amount is intentional.

---

## Example (canonical — Edit price)

| Step | State |
|------|--------|
| 1 | Seller lists ask **40 USDC** (active) |
| 2 | Buyer places token offer **38 USDC** on that `tokenId` |
| 3 | Platform notifies the wallet with an **active ask on that `tokenId`** |
| 4 | Seller taps notification CTA **Edit price** |
| 5 | App opens **Portfolio → My Assets** Set/Edit price drawer (`?setprice={tokenId}`) |
| 6 | Seller sets ask to **38** and confirms; app lists at 38 and tries instant match |
| 7a Success | On-chain settle at **38**; NFT transfers; ask ends |
| 7b Failure (buyer USDC / allowance) | Dead bid **invalidated**; **ask stays live at 38** (the price just set). Instant-only auto-cancel does **not** apply for buyer-funding failures. |
| 7c Failure (other: merkle, timeout, …) | Instant-only protection may still cancel the new ask when enforce-immediate-fill was on |

---

## Product rules (locked)

### Offer type (P0)

- **In scope:** card-level **token offers** (`tokenId` specific), per BR-8a.
- **Out of scope for first ship:** collection criteria / Merkle bids (Phase 6+ if needed).

### Who gets notified

- Recipients: wallets/users with an **active Seaport ask** on the **same `tokenId`** as the new bid.
- **Not** every seller in the collection (avoids noise and wrong accept targets).
- Same recipient when that token bid is **cancelled** (`Offer cancelled` inbox row; no Accept CTA).

### CTA deep link

Locked query params:

- Notification CTA **Edit price** → `/portfolio?setprice={tokenId}` (opens Set/Edit price drawer when owned).
- Accept-offer deep link (holdings / legacy): `acceptBid=<bidOrderHash>`, `tokenId=<id>`, optional `askHash=<askOrderHash>`.

### Edit price + instant match (primary)

- Seller explicitly updates the ask, then the client may attempt instant fill against crossing bids.
- **Buyer funding failure** (`insufficient_balance` / `insufficient_allowance`):
  - Invalidate the dead bid (`PATCH …/invalidate-dead-bid`).
  - **Keep** the ask at the price the seller just set (do not instant-only cancel).
  - Notify **ask owner** (`Offer could not be filled`) and **bidder** (`Your offer couldn't be filled` / Add funds).
- Other instant-match failures may still auto-cancel under instant-only protection.

### Accept modal (secondary)

- Shows: asset identity, **current ask price** (reference), **offer price**, buyer short wallet, primary **Confirm trade** CTA.
- Confirm does **not** re-sign a new ask at the offer price.
- Pre-flight: buyer USDC balance + Seaport USDC allowance; block CTA if insufficient.
- On failed accept (buyer unfunded): **do not** cancel/replace/reprice the existing ask; invalidate the dead bid. (Seller who wants the offer price live should use **Edit price**.)

### Dead offer handling

- If settle fails because the buyer is unfunded / allowance revoked / order no longer fillable: mark that bid **invalidated or cancelled** in `orders` so other sellers do not hit the same failure.
- Invalidation is idempotent by `order_hash`.
- API: `PATCH /api/marketplace/orders/:hash/invalidate-dead-bid` (on-chain underfunded/expired check).

### List / Change price

- **Edit price** is the path to take a lower bid (set ask to offer, attempt fill).
- Instant match after Edit price / list must consider **crossing token bids** on that `tokenId` (not only collection criteria bids). Buyer-funding failure → keep ask, `invalidate-dead-bid` (seller + bidder inbox), remove offer from the book.
- Sell ticket copy may surface the top bid as a suggestion; seller still confirms the price.

---

## Technical anchors

| Piece | Location |
|-------|----------|
| Accept token offer (ask untouched) | `frontend/lib/seaport/fulfillment/acceptTokenOffer.ts` |
| Buyer USDC preflight | `checkBuyerUsdcReadyForBid` in `runCriteriaMatch.ts` |
| Dead-bid invalidate API | `PATCH /api/marketplace/orders/:hash/invalidate-dead-bid` |
| Bid → ask-owner notifications | `marketplace_notifications` + `NotificationsService.notifyAskOwnerOfTokenBid` / `notifyAskOwnerOfTokenBidCancelled` / `notifyAskOwnerOfUnfilledBid` |
| Bidder dead-bid notification | `NotificationsService.notifyBidderOfDeadBid` (from `invalidateDeadBid`) |
| Notifications inbox API | `GET /api/marketplace/notifications` (JWT) |
| Post-list instant match + keep-ask on funding fail | `runPostListInstantMatch` in `listRwaInstantMatch.ts` (`isBuyerFundingMatchFailure`) |
| Token offer + listing match | `frontend/lib/seaport/fulfillment/runCriteriaMatch.ts`, `criteriaMatch.ts` |
| Matched pair API | `POST /api/marketplace/orders/fulfill-matched-pair` |
| Bid fulfill clears sibling **asks** only | `OrdersService.fulfillOrder` / `fulfillMatchedPair` (other token bids stay on the book) |
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
| **E** | Notification CTA → Edit price; remove lower-to-match-only copy | Done |
| **F** | Docs sync, invalidation, regression | Done |
| **G** | Buyer-funding fail after Edit price → keep ask at set price; invalidate dead bid | Done |

---

## Regression checklist

Manual / smoke:

1. List ask **40** → place token bid **38** → ask owner sees inbox **Edit price** (not all collection sellers).
2. Collection Offers book shows the **38** token bid (not criteria-only).
3. Edit price → set **38** → confirm → settle succeeds; ask cleared; NFT to bidder.
4. Edit price → set **38** → buyer insufficient USDC / allowance → bid invalidated; **ask stays 38**.
5. Accept-offer path: buyer unfunded → bid invalidated; **prior ask unchanged** (still 40 if never edited).
6. After accept / dead-bid invalidate / kept ask, orders + portfolio + notifications caches refresh.

Automated:

- `backend` / `frontend` `pnpm exec tsc --noEmit`
- `pnpm exec jest src/marketplace/notifications/notifications.service.spec.ts`
- `pnpm exec jest src/marketplace/utils/platform-tape.util.spec.ts`

---

## Non-goals

- New escrow or new marketplace protocol for Vault trades
- Holding bidder USDC until accept
- Notifying all collection listers for every token offer
- Replacing Seaport with Boson/Cyfrin for this flow
