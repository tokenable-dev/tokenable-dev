# Sumsub KYC (WebSDK 2.0)

Tokenable uses [Sumsub WebSDK 2.0](https://docs.sumsub.com/docs/get-started-with-web-sdk) for identity verification. Auth remains Privy; KYC status is stored on `users.kyc_status` and updated from Sumsub webhooks (source of truth).

## Phase 0 — Sandbox setup (Dashboard)

1. Create a **Sandbox** app in the [Sumsub Dashboard](https://cockpit.sumsub.com/).
2. Create a verification **level** and enable **WebSDK 2.0** for that level ([migration guide](https://docs.sumsub.com/docs/migrate-from-websdk-to-websdk-20)).
3. Copy **App token** and **Secret key** (Sandbox).
4. Note the **level name** (e.g. `basic-kyc-level`).
5. Under **Developer tools → Webhooks**, add:
   - URL: `https://<your-api-host>/api/webhooks/sumsub`
   - Events: at minimum `applicantReviewed`, `applicantPending`
   - Use the webhook secret (or reuse the app secret key).

## Environment variables (backend only)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUMSUB_APP_TOKEN` | Yes | Sandbox/production app token |
| `SUMSUB_SECRET_KEY` | Yes | API secret (also used for webhook HMAC if `SUMSUB_WEBHOOK_SECRET` unset) |
| `SUMSUB_LEVEL_NAME` | Yes | Verification level name from Dashboard |
| `SUMSUB_BASE_URL` | No | Default `https://api.sumsub.com` |
| `SUMSUB_WEBHOOK_SECRET` | No | Webhook HMAC secret; falls back to `SUMSUB_SECRET_KEY` |

Never expose `SUMSUB_SECRET_KEY` or webhook secrets in frontend code.

## API

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/kyc/status` | JWT | Current user KYC snapshot |
| `POST` | `/api/kyc/access-token` | JWT | Issue WebSDK access token |
| `POST` | `/api/webhooks/sumsub` | HMAC (`X-Payload-Digest`) | Sumsub status updates |

`externalUserId` in Sumsub = `users.id` (UUID). Applicant id is stored in `users.kyc_external_id`.

## Frontend

- Page: `/kyc` — loads `@sumsub/websdk-react` with token from backend.
- Wallet menu: **Verify Identity** (when KYC not complete).
- `KycRequiredModal` navigates to `/kyc`.

SDK completion events are UI hints only; final status comes from webhooks.

## Going live

See [Get production key](https://docs.sumsub.com/docs/get-production-key). Production settings are **not** copied from Sandbox — recreate webhooks, levels, and use production app token/secret.

## Related docs

- [Auth API — KYC](../api/auth.md#kyc)
- [Privy auth migration — Phase 5](./privy-auth-migration.md)
