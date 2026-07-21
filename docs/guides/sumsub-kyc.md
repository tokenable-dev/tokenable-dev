# Sumsub KYC (WebSDK 2.0)

Tokenable uses [Sumsub WebSDK 2.0](https://docs.sumsub.com/docs/get-started-with-web-sdk) for identity verification. Auth remains Privy; KYC status is stored on `users.kyc_status` and updated from Sumsub webhooks (source of truth).

## Product levels

| Level | Requirements | Allowed |
|-------|--------------|---------|
| 0 | Signed out / no wallet | Markets browse |
| 1 | Privy session + linked wallet | Buy Now, Bid, list for sale, open Vault UI |
| 2 | KYC `approved` | Ship card to vault (deposit), redeem physical card |

KYC is **not** triggered at signup. Investor Profile (investment qualification) is a separate future flow.

### Trigger points (Level 2)

1. **Vault design flow** — before “Continue to Shipping” / “Mark as shipped”
2. **Real mint** — `POST` mint via backend (`useMintForm` + `RwaMintService`)
3. **Physical redeem** — `POST /api/rwa/redeem-request` (API gated; FE CTA when built)

Optional Fractional first-purchase KYC is deferred.

## Phase 0 — Sandbox setup (Dashboard)

1. Create a **Sandbox** app in the [Sumsub Dashboard](https://cockpit.sumsub.com/).
2. Use the standard **`id-and-liveness`** level (ID + liveness), or create a custom level with the same steps. Prefer auto-approve; exceptions go to manual review.
3. Copy **App token** and **Secret key** (Sandbox).
4. Set `SUMSUB_LEVEL_NAME` to the exact Dashboard level name (Tokenable local/staging: `id-and-liveness`).
5. Under **Dev space → Webhooks**, add the staging endpoint (see environments below).
6. Under **Dev space → WebSDK settings → Domains to host WebSDK**, allowlist frontend origins.

### Environments (Tokenable)

| Env | Frontend | Backend API | Sumsub webhook URL |
|-----|----------|-------------|--------------------|
| Local | `http://localhost:3000` | `http://localhost:4100` | Sumsub cannot call `localhost` — use ngrok/Cloudflare Tunnel → `https://<tunnel>/api/webhooks/sumsub`, or test SDK on local and rely on staging webhook |
| Staging | `https://tokenable-dev.com` | `https://tokenable-dev.com/api/...` | **`https://tokenable-dev.com/api/webhooks/sumsub`** |

Local `.env` already uses `FRONTEND_URL=http://localhost:3000`, `PORT=4100`, `SUMSUB_LEVEL_NAME=id-and-liveness`. Put the same `SUMSUB_*` values on the staging server env and restart Nest.

### Dashboard checklist (you must click these)

1. **Levels** — use personal level `id-and-liveness` (already matches `.env`).
2. **Dev space → App tokens** — Sandbox token + secret in local + staging `SUMSUB_*` (done for local).
3. **Dev space → Webhooks → Create webhook**
   - Target: `https://tokenable-dev.com/api/webhooks/sumsub`
   - Types: at least `applicantReviewed`, `applicantPending` (Individual)
   - Signature: **SHA256**
   - Copy the webhook **비밀 키** into staging (and local) `SUMSUB_WEBHOOK_SECRET` — this is **not** the App Token secret. A digest mismatch (`401 Invalid Sumsub webhook digest`) means the server secret ≠ Dashboard webhook secret (not the site-access password).
4. **Dev space → WebSDK settings → Domains to host WebSDK** — add:
   - `http://localhost:3000`
   - `https://tokenable-dev.com`
5. Keep **Sandbox mode** until production go-live (simulated results are OK for integration testing).

## Environment variables (backend only)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUMSUB_APP_TOKEN` | Yes | Sandbox/production app token |
| `SUMSUB_SECRET_KEY` | Yes | API secret (also used for webhook HMAC if `SUMSUB_WEBHOOK_SECRET` unset) |
| `SUMSUB_LEVEL_NAME` | Yes | Verification level name from Dashboard (e.g. `id-and-liveness`) |
| `SUMSUB_BASE_URL` | No | Default `https://api.sumsub.com` |
| `SUMSUB_WEBHOOK_SECRET` | No | Webhook HMAC secret; falls back to `SUMSUB_SECRET_KEY` |

Never expose `SUMSUB_SECRET_KEY` or webhook secrets in frontend code.

## Flow

1. User hits a Level-2 action → frontend `useAccessGate(2)` → `KycRequiredModal` (status-aware copy) → `/kyc`.
2. `POST /api/kyc/access-token` creates/reuses Sumsub applicant (`externalUserId` = Tokenable `users.id`) and returns SDK token (`ttl` from Sumsub API; level from `SUMSUB_LEVEL_NAME`).
3. User completes WebSDK (ID + liveness).
4. Sumsub webhook `applicantReviewed` → HMAC verify → `users.kyc_status` `approved` / `rejected`.
5. Approved user continues vault ship / redeem. Rejected users see reason + retry on `/kyc`.

Reusable KYC: same applicant id is reused on later `access-token` calls.

## API

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/kyc/status` | JWT | Current user KYC snapshot |
| `POST` | `/api/kyc/access-token` | JWT | Issue WebSDK access token |
| `POST` | `/api/webhooks/sumsub` | HMAC (`X-Payload-Digest`) | Sumsub status updates |

Custody enforcement (server):

- `RwaMintService.mintForUser` — requires KYC approved
- `RwaRedeemService.requestRedemption` — requires KYC approved

## Frontend

- Page: `/kyc` — `@sumsub/websdk-react`; after approval, continues to `pendingReturnTo` (vault path) when set
- `KycRequiredModal` — Start Verification / pending / rejected copy
- Gates: vault submit & shipping design CTAs, mint form; sell/list stays Level 1

SDK completion events are UI hints only; final status comes from webhooks.

## Not in this phase

- Chat notification on KYC ready (align later with messaging PRD)
- Hard 3-attempt retry queue (Sumsub dashboard retry policy for now)
- Fractional purchase KYC trigger
- Investor Profile merge

## Going live

See [Get production key](https://docs.sumsub.com/docs/get-production-key). Production settings are **not** copied from Sandbox — recreate webhooks, levels, and use production app token/secret. Remove the `tokenable.dev@gmail.com` KYC bypass before mainnet public launch (`frontend/lib/auth/accountAccess.ts` + `backend/src/kyc/utils/kyc-gate.util.ts` — keep emails identical until then).

## Code layout

| Layer | Home |
|-------|------|
| Sumsub API + webhook | `backend/src/kyc/` |
| KYC status persistence | `backend/src/user/` (`updateKycStatus`, `user_kyc_events`) |
| Privy token verify | `backend/src/auth/privy/` |
| Privy API proxy / funding catalog | `backend/src/privy/` |
| Frontend Privy | `frontend/lib/privy/` |
| Frontend KYC client + page | `frontend/lib/kyc/`, `frontend/app/kyc/` |

## Related docs

- [Auth API — KYC](../api/auth.md#kyc)
- [Privy auth migration — Phase 5](./privy-auth-migration.md)
