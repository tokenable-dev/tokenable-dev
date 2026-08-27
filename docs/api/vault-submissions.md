# Vault submissions API

Sell-flow package tracking (local cards → ship package → PSA → mint link).

**Auth:** `JwtAuthGuard` (cookie session).  
**Base:** `/api/vault/submissions`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | List my submissions (newest first) |
| `GET` | `/:idOrPublicId` | Detail by uuid or `SUB-…` (`SUB-YYYYMMDD-#####`, daily sequence e.g. `00001`) |
| `POST` | `/draft` | Upsert **shipping package** (`{ publicId?, cards[] }` all `confirmed: true`) → `awaiting_shipment`. Does **not** create `status=draft` rows. |
| `PATCH` | `/:idOrPublicId/draft` | Same upsert with pinned public id |
| `POST` | `/:idOrPublicId/packing-slip` | Mark packing slip downloaded |
| `POST` | `/:idOrPublicId/tracking` | Register or **update** carrier + tracking → `in_transit` (allowed from `awaiting_shipment` or `in_transit`) |

### Card payload

```json
{ "cert": "12345678", "name": "…", "grade": 10, "img": null, "confirmed": true }
```

`POST /draft` requires **≥1 card** and **every** card `confirmed: true`. Otherwise `400` with a client-readable message (Add-cards UI keeps drafts in `localStorage` only).

### Response

Includes `scenario` (`A`–`H`) for Vault-Detail UI, plus `items[]` and shipment fields.

### Draft resume (frontend)

Sell-flow **Add cards** is **local-only** (`localStorage`) — it does **not** create `vault_submissions` rows with `status=draft`.

| Layer | What |
|-------|------|
| `localStorage` (`tk_sell_flow_draft`) | Card list (cert, confirm flags) |
| `localStorage` (`tk_sell_flow_progress`) | Step (`register` / `vault` / `cards` / `shipping-pack` / `shipping-track`), packing slip downloaded flag, tracking form |
| Account API on `/sell/shipping` mount | **First durable write** — upsert confirmed cards → `awaiting_shipment` (retry UI if fail). Tracking confirm upserts again then `POST …/tracking` → `in_transit`. Return address prefills from Settings **default** (`GET /user/shipping-addresses`, `isDefault` else first), else Partner **Origin** (`GET /marketplace/partners/me` `companyAddress`). User can edit for this shipment. If neither exists, local progress is the fallback (not yet sent to PSA intake APIs). |
| Change Tracking | Vault Detail / success UI → `/sell/shipping?submission=<publicId>`. Loads the `in_transit` package, prefills carrier + number, and calls `POST …/tracking` only (no draft upsert). |

**Register / seller consents:** `/sell/flow` always opens on the register screen. Consents are session-only and must be re-accepted each visit. Draft cards may still resume after Continue. Optional `?vault=self` (Partner Add Cards) prefills Partner vault so Continue skips Choose vault.

**Partner vault mint queue:** confirmed cards mint **one at a time**. A per-card failure (already minted cert, PSA shipment block, missing image, PSA lookup error, etc.) **skips that card and continues**. The result modal lists registered token IDs and skip reasons. Succeeded certs are removed from the local list; skipped certs stay for retry. Partner-eligibility errors (no company address / not a partner) stop the remaining queue.

Vault hub (`/vault`) active view mirrors `Tokenable-with design system-22/Vault-Dashboard-Active.html`: **All · In transit · Verifying · Vaulted · Rejected** plus a per-card stepper (not package ip-cards). `in_transit` / `awaiting_shipment` → In transit (Add tracking still works before a number is set). `psa_reviewing` open items → Verifying. Item `completed` → Vaulted (green note + Portfolio link). Rejected / failed items (and scenario `F` / `H` without per-item flags) → Rejected with reason copy; primary CTA opens the existing submission detail (or carrier track for “not received”). Partner-vault holdings are **not** listed here (Portfolio only). Pre-ship drafts do not appear — resume Add cards via `/sell/flow`. After tracking confirm, local draft keys are cleared.

**Legacy cleanup:** `backend/sql/maintenance/cancel_legacy_vault_submission_drafts.sql` sets orphan `status=draft` packages (no tracking) to `cancelled`.

Users can move freely before shipment confirm: clickable **Submit / Ship / Portfolio** indicators, Back buttons (register ↔ cards ↔ pack ↔ track), and add/remove of PSA cards on Add Cards or the shipping package list.

### Mint bridge

`RwaMintService` calls `attachCycleForCert` after `reserveCycleForDeposit`, then `markItemCompletedForCycle` after successful mint — linking sell-flow items to `vault_cycles` / live portfolio.

### Admin ops

Marketplace admin session (not JWT): `/api/marketplace/admin/vault-submissions` — counts, list, mark arrived, package/item status, **mint-queue**, **mint-and-deliver**. UI: `/marketplace/admin/vault/submissions` · `/marketplace/admin/vault/mint-queue`. See [marketplace-admin.md](./marketplace-admin.md).

**Mint & deliver (PSA → Live):** `GET …/mint-queue` lists `reviewing`/`approved` items on `psa_reviewing` packages. Gmail vault-confirmation mail (“now secured in your PSA Vault”) auto-runs the same `mint-and-deliver` path (`vault_psa_vaulted_reviews`). Manual: `POST …/:id/items/:itemId/mint-and-deliver`.

**Mint image:** preferred order is PSA cert front → Cardhedger mint image (from analyze) → submission item `imageUrl` → **Cardhedger catalog resolve** (same path as collection cover: `details-by-certs` / card-search → Bubble `cdn.bubble.io/.../crop_image` etc.) → bundled Tokenable logo (`backend/src/assets/tokenable_logo.png`). Mint is not blocked when PSA slab images are missing.

### Sell flow vault choice

`/sell/flow` → **PSA vault** uses this submissions + shipping pipeline (mint later lands in custody; admin delivers).  
**Self vault** reuses the same Add-cards UI, then mints via `POST /api/rwa/upload` + `POST /api/rwa/mint` with `deliveryMode: "direct"` so the NFT goes straight to the minter's linked wallet / portfolio (no admin Custody deliver).

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
   - `backend/sql/maintenance/add_vault_psa_arrival_reviews.sql`
   - `backend/sql/maintenance/add_vault_psa_arrival_reviews_ingest_note.sql` (if table already existed without `ingest_note`)
   - `backend/sql/maintenance/add_vault_psa_arrival_reviews_auto_confirm.sql` (`confirmed_via`, `skipped_public_ids`)
   - `backend/sql/maintenance/add_vault_psa_vaulted_reviews.sql` (PSA → Live audit)
2. Set `GMAIL_*` + `PSA_RECEIVED_MAIL_ENABLED=1` + **`PSA_VAULTED_MAIL_ENABLED=1`** on the **API host** (not frontend). If vaulted flag is unset, it inherits the arrival flag (startup warns).
3. Ensure PSA Vault mail lands in `GMAIL_USER` (native or forward).
4. Confirm startup logs: `PSA received-mail poll armed …` and `PSA vaulted-mail poll armed …`.
5. Admin UI: `/marketplace/admin/vault/psa-mail` (inbox / test inject) · `/marketplace/admin/vault/submissions` (packages) · mint-queue vaulted tabs (Pending first).

Do not log refresh tokens or full message bodies — only `messageId`, certs, public ids, and `ingestNote`.
