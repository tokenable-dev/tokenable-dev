# Vault submissions API

Sell-flow package tracking (draft → ship → PSA → mint link).

**Auth:** `JwtAuthGuard` (cookie session).  
**Base:** `/api/vault/submissions`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | List my submissions (newest first) |
| `GET` | `/:idOrPublicId` | Detail by uuid or `SUB-…` |
| `POST` | `/draft` | Upsert draft cards (`{ publicId?, cards[] }`) |
| `PATCH` | `/:idOrPublicId/draft` | Same as draft with pinned public id |
| `POST` | `/:idOrPublicId/packing-slip` | Mark packing slip downloaded |
| `POST` | `/:idOrPublicId/tracking` | Register carrier + tracking → `in_transit` |

### Card payload

```json
{ "cert": "12345678", "name": "…", "grade": 10, "img": null, "confirmed": true }
```

### Response

Includes `scenario` (`A`–`H`) for Vault-Detail UI, plus `items[]` and shipment fields.

### Draft resume (frontend)

Sell flow persists progress so users can leave and return:

| Layer | What |
|-------|------|
| `localStorage` (`tk_sell_flow_draft`) | Card list (cert, confirm flags) |
| `localStorage` (`tk_sell_flow_progress`) | Step (`register` / `cards` / `shipping-pack` / `shipping-track`), packing checklist, tracking form |
| Account API `POST /draft` | Debounced upsert while signed in; rehydrate on return if local empty |

Vault hub lists `draft` and `awaiting_shipment` with **Continue** / **Ship**. After tracking confirm, local draft keys are cleared (shipment record kept).

Users can move freely before shipment confirm: clickable **Submit / Ship / Portfolio** indicators, Back buttons (register ↔ cards ↔ pack ↔ track), and add/remove of PSA cards on Add Cards or the shipping package list.

### Mint bridge

`RwaMintService` calls `attachCycleForCert` after `reserveCycleForDeposit`, then `markItemCompletedForCycle` after successful mint — linking sell-flow items to `vault_cycles` / live portfolio.

### Admin ops

Marketplace admin session (not JWT): `/api/marketplace/admin/vault-submissions` — counts, list, mark arrived, package/item status. UI: `/marketplace/admin/vault/submissions`. See [marketplace-admin.md](./marketplace-admin.md).

### Sell flow vault choice

`/sell/flow` → **PSA vault** uses this submissions + shipping pipeline (mint later lands in custody; admin delivers).  
**Self vault** reuses the same Add-cards UI, then mints via `POST /api/rwa/upload` + `POST /api/rwa/mint` with `deliveryMode: "direct"` so the NFT goes straight to the minter's linked wallet / portfolio (no admin Custody deliver).

### PSA “Items Received” mail → admin review → `psa_reviewing`

After the seller registers tracking (`in_transit`), PSA eventually sends **Items Received at PSA Vault** to `tokenable.dev@gmail.com`. A Nest cron polls Gmail and **queues** a review row — it does **not** auto-advance packages.

Ops opens **PSA mail** admin (`/marketplace/admin/vault/psa-mail`), checks the matched user/package, then **Confirm → At PSA** (calls the same mark-arrived path). **Dismiss** drops a false positive. Rows with `ingestNote` (e.g. `no_certs`) mean parse was incomplete — use manual **Mark arrived** on Submissions or fix the mail format; do not silent-drop.

| Piece | Detail |
|-------|--------|
| Poll | `PsaReceivedMailService` → `enqueuePsaArrivalReview` |
| Table | `vault_psa_arrival_reviews` (`pending` / `confirmed` / `dismissed`, optional `ingest_note`) |
| Admin API | `GET …/arrival-reviews`, `POST …/arrival-reviews/:id/confirm`, `…/dismiss`, `POST …/arrival-reviews/test-inject` (dev: `PSA_RECEIVED_MAIL_TEST_INJECT=1`) |
| Manual fallback | Per-package **Mark arrived** still available |
| Multi-instance | Postgres `pg_try_advisory_lock` so only one API replica polls at a time |
| Backlog | Up to 200 messages per poll (paged); remainder next cron |

**Env (server only):**

```env
PSA_RECEIVED_MAIL_ENABLED=0
PSA_RECEIVED_MAIL_CRON=*/1 * * * *
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
GMAIL_USER=tokenable.dev@gmail.com
```

**OAuth scopes (production):** prefer `https://www.googleapis.com/auth/gmail.modify` only (read + label).  
`https://mail.google.com/` also works but grants full mailbox control — **not a billing issue**, a **blast-radius / security** issue. Keep full scope only if you still need insert/test tooling; otherwise re-consent with `gmail.modify` and replace `GMAIL_REFRESH_TOKEN`.

**OAuth app publishing:** If the Cloud OAuth consent screen is still **Testing**, refresh tokens for test users typically expire about **every 7 days**. There is no reliable “auto refresh forever” in Testing — you must re-consent, or **publish the app (In production)** so tokens stay long-lived. Note: `gmail.modify` is a sensitive scope; `mail.google.com` is restricted and much harder to verify with Google.

**Ops checklist (staging/prod):**

1. Apply SQL: `backend/sql/maintenance/add_vault_psa_arrival_reviews.sql` (and `add_vault_psa_arrival_reviews_ingest_note.sql` if the table already existed without `ingest_note`).
2. Set `GMAIL_*` + `PSA_RECEIVED_MAIL_ENABLED=1` on the **API host** (not frontend).
3. Ensure PSA Vault mail lands in `GMAIL_USER` (native or forward).
4. Confirm startup log: `PSA received-mail poll armed …`.
5. Admin UI: `/marketplace/admin/vault/psa-mail` (inbox) · `/marketplace/admin/vault/submissions` (packages).

Do not log refresh tokens or full message bodies — only `messageId`, certs, public ids, and `ingestNote`.
