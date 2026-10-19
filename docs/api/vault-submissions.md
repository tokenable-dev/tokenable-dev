# Vault submissions API

Sell-flow package tracking (local cards → ship package → PSA → mint link).

**Auth:** `JwtAuthGuard` (cookie session).  
**Base:** `/api/vault/submissions`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | List my submissions for the request chain's configured RWA (newest first). Other contracts and unstamped leftovers are omitted |
| `GET` | `/:idOrPublicId` | Detail by uuid or `SUB-…` (`SUB-YYYYMMDD-#####`, daily sequence e.g. `00001`) |
| `POST` | `/draft` | Upsert **shipping package** (`{ publicId?, cards[] }` all `confirmed: true`) → `awaiting_shipment`. Does **not** create `status=draft` rows. |
| `PATCH` | `/:idOrPublicId/draft` | Same upsert with pinned public id |
| `POST` | `/:idOrPublicId/packing-slip` | Mark packing slip downloaded |
| `POST` | `/:idOrPublicId/tracking` | Register or **update** carrier + tracking → `in_transit` (allowed from `awaiting_shipment` or `in_transit`) |

### Card payload

```json
{
  "cert": "12345678",
  "name": "Charizard ex",
  "grade": 10,
  "img": null,
  "confirmed": true,
  "cardNumber": "199/165",
  "year": "2023",
  "setName": "151",
  "language": "EN",
  "variant": "Special Illustration Rare"
}
```

`POST /draft` requires **≥1 card** and **every** card `confirmed: true`. Otherwise `400` with a client-readable message (Add-cards UI keeps drafts in `localStorage` only).

### Response

Includes `scenario` (`A`–`H`) for Vault-Detail UI, plus `items[]` and shipment fields.

### Draft resume (frontend)

Sell entry is the choose-vault screen (`SellFlowChooseVault`) on an empty `/vault`, and again at `/sell/flow` from the hub **+ Sell a Card** button. Continue on that screen is not wired yet. KYC, seller-terms, and add-cards screens are not part of this entry.

`/sell/shipping` still upserts a package the browser already has in `localStorage` (`tk_sell_flow_draft`) as `awaiting_shipment`. It does not create `status=draft` rows. Browser drafts are cleared when the configured RWA address changes (`tk_sell_flow_contract`). Shipping upserts stamp `token_contract` from `x-tokenable-chain-id`.

| Layer | What |
|-------|------|
| `localStorage` (`tk_sell_flow_draft`) | Card list used by shipping when a package is already in the browser. The choose-vault screen does not edit this list. |
| `localStorage` (`tk_sell_flow_progress`) | Shipping step (`shipping-pack` / `shipping-track`), packing slip downloaded flag, tracking form. Older step names (`register`, `vault`, `cards`) still parse. |
| Account API on `/sell/shipping` mount | **First durable write** — upsert confirmed cards → `awaiting_shipment` (retry UI if fail). Tracking confirm upserts again then `POST …/tracking` → `in_transit`. Return address prefills from Settings **default** (`GET /user/shipping-addresses`, `isDefault` else first), else Partner **Origin** (`GET /marketplace/partners/me` `companyAddress`). User can edit for this shipment. If neither exists, local progress is the fallback (not yet sent to PSA intake APIs). |
| Change Tracking | Vault Detail → `/sell/shipping?submission=<publicId>`. Loads the `in_transit` package, prefills carrier + number, and **Done** calls `POST …/tracking` only (no draft upsert). |

**Partner vault mint queue:** the add-cards UI that minted one cert at a time is removed. `POST /api/rwa/mint` with `deliveryMode: "direct"` is unchanged for other callers.

**PSA vault:** `/sell/shipping` still refuses to open with an empty confirmed card list and returns to `/vault`.

Vault hub (`/vault`) active view mirrors `Vault-Dashboard-Active.html`: **Sell**, a **Sell cards** tile, then **Vaulting progress** with **All · Shipped · Verifying · Vaulted · Rejected**. Each row is one submission (stacked thumbs, status pill, card count, shipping line, action). `in_transit` / `awaiting_shipment` → Shipped (**Add tracking** until a number exists, then **Track**). `psa_reviewing` → Verifying. Completed packages → Vaulted (**View** opens Portfolio). Rejected packages → **Contact support**. Partner-vault holdings are **not** listed here. **Done** on `/sell/shipping` registers tracking and opens this hub. Local draft keys are cleared.

**Legacy cleanup:** `backend/sql/maintenance/cancel_legacy_vault_submission_drafts.sql` sets orphan `status=draft` packages (no tracking) to `cancelled`.

Users can still pack and track an existing shipment: Back from shipping returns to `/vault`, and cards can be removed from the package list.

### Mint bridge

`RwaMintService` calls `attachCycleForCert` after `reserveCycleForDeposit`, then `markItemCompletedForCycle` after successful mint — linking sell-flow items to `vault_cycles` / live portfolio.

### Admin ops

Marketplace admin session (not JWT): `/api/marketplace/admin/vault-submissions` — counts, list, mark arrived, package/item status, **mint-queue**, **mint-and-deliver**. UI: `/marketplace/admin/vault/submissions` · `/marketplace/admin/vault/mint-queue`. See [marketplace-admin.md](./marketplace-admin.md).

**Mint & deliver (PSA → Live):** `GET …/mint-queue` lists `reviewing`/`approved` items on `psa_reviewing` packages. Gmail vault-confirmation mail (“now secured in your PSA Vault”) auto-runs the same `mint-and-deliver` path (`vault_psa_vaulted_reviews`). Manual: `POST …/:id/items/:itemId/mint-and-deliver`.

**Mint image priority:** PSA cert slab → user/submission upload → Cardhedger catalog (never Cardhedger’s branded placeholder card) → bundled Tokenable default (`backend/src/assets/tokenable_mint_placeholder.png`). `properties.mintImageSource` records which tier was pinned. Cardhedger `cardId` stays in metadata for pricing/collection matching even when catalog art is unavailable.

### Sell flow vault choice

Empty `/vault` and `/sell/flow` show **Sell your cards** / **Choose a vault** (PSA Vault and Approved Partners). **Vaulting Agreement** opens a draft terms modal. Continue opens PSA add-cards (then `/sell/shipping`) or the partner mint screen when the account is an appointed partner with a company address. Vault mint does not require KYC during POC. Redeem still does.

**PSA vault** Continue opens add-cards, then `/sell/shipping` (mint later lands in custody; admin delivers).  
**Approved Partners** Continue opens the partner add-cards screen, which mints with `deliveryMode: "direct"`. Non-partners and partners without a company address cannot continue on that choice.

**Self vault lock after ship:** once a package has finished the ship step (`tracking` → `in_transit`) — or is further along (`psa_reviewing`, item `reviewing` / `approved` / `minting`) — that cert **cannot** be minted with `deliveryMode=direct`. Enforced in `VaultSubmissionService.assertCertAvailableForSelfVault` from `RwaMintService` (global by cert, not only the current user). Open `awaiting_shipment` packages are still editable via ship upsert; rejected/failed/completed items do not block self vault.

### PSA “Items Received” mail → admin review → `psa_reviewing`

After the seller registers tracking (`in_transit`), PSA eventually sends **Items Received at PSA Vault** to `tokenable.dev@gmail.com`. A Nest cron polls Gmail, enqueues a review row, and **auto-confirms** matched open packages to `psa_reviewing` (same path as admin **Confirm → At PSA**).

Ops opens **PSA mail** admin (`/marketplace/admin/vault/psa-mail`): **Processed** tab lists auto- and manually confirmed mail (`confirmedVia`: `auto` | `admin`, plus `skippedPublicIds` when mark-arrived failed for a package). **Pending** holds incomplete parses (`ingestNote`) or no open package match — use manual **Confirm** or **Mark arrived** on Submissions. **Dismiss** drops false positives.

| Piece | Detail |
|-------|--------|
| Poll | `PsaReceivedMailService` → `enqueuePsaArrivalReview` + `maybeAutoConfirmPsaArrivalReview` |
| Table | `vault_psa_arrival_reviews` (`pending` / `confirmed` / `dismissed`, `confirmed_via`, `skipped_public_ids`, optional `ingest_note`) |
| Admin API | `GET …/arrival-reviews`, `POST …/arrival-reviews/:id/confirm`, `…/dismiss`, `POST …/arrival-reviews/test-inject` (dev: `PSA_RECEIVED_MAIL_TEST_INJECT=1`) |
| Manual fallback | Per-package **Mark arrived** still available |
| Multi-instance | Postgres `pg_try_advisory_lock` so only one API replica polls at a time |
| Backlog | Up to 200 messages per poll (paged); remainder next cron |

**Env (server only):**

```env
PSA_RECEIVED_MAIL_ENABLED=0
PSA_RECEIVED_MAIL_AUTO_CONFIRM=1
PSA_RECEIVED_MAIL_CRON=*/1 * * * *
PSA_VAULTED_MAIL_ENABLED=1
PSA_VAULTED_MAIL_AUTO_MINT=1
PSA_VAULTED_MAIL_CHAIN_ID=
PSA_VAULTED_MAIL_CRON=*/1 * * * *
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
GMAIL_USER=tokenable.dev@gmail.com
```

**OAuth scopes (production):** prefer `https://www.googleapis.com/auth/gmail.modify` only (read + label).  
`https://mail.google.com/` also works but grants full mailbox control — **not a billing issue**, a **blast-radius / security** issue. Keep full scope only if you still need insert/test tooling; otherwise re-consent with `gmail.modify` and replace `GMAIL_REFRESH_TOKEN`.

**OAuth app publishing:** If the Cloud OAuth consent screen is still **Testing**, refresh tokens for test users typically expire about **every 7 days**. There is no reliable “auto refresh forever” in Testing — you must re-consent, or **publish the app (In production)** so tokens stay long-lived. Note: `gmail.modify` is a sensitive scope; `mail.google.com` is restricted and much harder to verify with Google.

**Ops checklist (staging/prod):**

1. Apply SQL (in order if table is new):
   - `backend/sql/maintenance/deploy-sync.sql` (PSA arrival + vaulted review tables/columns; run via `apply-deploy-maintenance.sh`)
2. Set `GMAIL_*` + `PSA_RECEIVED_MAIL_ENABLED=1` + **`PSA_VAULTED_MAIL_ENABLED=1`** on the **API host** (not frontend). If vaulted flag is unset, it inherits the arrival flag (startup warns).
3. Ensure PSA Vault mail lands in `GMAIL_USER` (native or forward).
4. Confirm startup logs: `PSA received-mail poll armed …` and `PSA vaulted-mail poll armed …`.
5. Admin UI: `/marketplace/admin/vault/psa-mail` (inbox / test inject) · `/marketplace/admin/vault/submissions` (packages) · mint-queue vaulted tabs (Pending first).

Do not log refresh tokens or full message bodies — only `messageId`, certs, public ids, and `ingestNote`.
