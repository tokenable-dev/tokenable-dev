# Auth API

**Controller:** `backend/src/auth/auth.controller.ts`  
**Base path:** `/api/auth`  
**Swagger tags:** `auth`, `privy-auth`

Authentication is handled exclusively by **Privy**. After Privy login, the backend issues a JWT as an `HttpOnly` cookie (`access_token`). Protected routes accept either the cookie or `Authorization: Bearer <token>`.

> **Legacy Google OAuth and email/password routes have been removed from the controller.** Email verification and password-reset services remain in the codebase for admin tooling only.

---

## Active endpoints

### `POST /api/auth/privy/session`

Exchange a Privy access token for a Tokenable session cookie.

Called automatically by `PrivySessionBridge` after every Privy authentication event. Clients do not call this directly.

- **Header:** `Authorization: Bearer <privy_access_token>` — the short-lived JWT from Privy `getAccessToken()`
- **On success:**
  - Verifies the Privy token via JWKS (or `PRIVY_JWT_VERIFICATION_KEY` PEM key if set)
  - Fetches the Privy user profile (embedded wallet, linked accounts, email, name)
  - Upserts a `users` row keyed on `privy_id` (or email for existing legacy accounts)
  - Syncs all wallet addresses from the Privy profile to `user_wallets`
  - Syncs all linked auth providers to `user_auth_providers`
  - Sets an `access_token` HttpOnly cookie (7-day default; see `JWT_EXPIRES_SEC`)
  - Returns `{ user: { id, email, privyId, walletAddress, kycStatus, wallets, ... } }`
- **Errors:**
  - `400 Bad Request` — Privy not configured, or profile is invalid
  - `401 Unauthorized` — Token signature invalid or expired

---

### `GET /api/auth/session`

Returns the current session user. Never returns `401`.

```json
// authenticated
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "privyId": "did:privy:...",
    "walletAddress": "0x...",
    "kycStatus": "none|pending|approved|rejected",
    "wallets": [...],
    "name": "...",
    "pictureUrl": "..."
  }
}

// unauthenticated
{ "user": null }
```

---

### `POST /api/auth/logout`

Clears the `access_token` cookie.

- **Response:** `204 No Content`

---

### `POST /api/auth/delete-account`

Permanently delete the authenticated account. Clears the session cookie.

- **Guard:** `JwtAuthGuard`
- **Response:** `204 No Content`
- **Side effects:** Deletes `users` row; `user_wallets`, `user_watchlist`, `user_auth_providers`, and `user_kyc_events` cascade

---

## Marketplace Admin Auth

Marketplace admin has a **separate** auth system (not Privy):

| Route | Purpose |
|-------|---------|
| `GET /api/marketplace/admin/auth/session` | Check admin session |
| `POST /api/marketplace/admin/auth/login` | Login with username/password |
| `POST /api/marketplace/admin/auth/logout` | Logout |

Admin credentials are stored in `marketplace_admins` table. Default dev: `skyand` / `071725` (override with `MARKETPLACE_ADMIN_USERNAME` / `MARKETPLACE_ADMIN_PASSWORD`).

---

## Authentication Flow

```
User → Privy login (email/Google/Apple/wallet)
     → Frontend PrivySessionBridge calls getAccessToken()
     → POST /api/auth/privy/session (Bearer privy_token)
     → PrivyService.verifyAccessToken() — JWKS or PEM key
     → fetchUser(privyId) → parsePrivyUserProfile()
     → UserService.findOrCreateFromPrivy()
       → upsert users by privy_id or email
       → syncPrivyWallets() → user_wallets
       → syncPrivyIdentity() → user_auth_providers
     → issueAccessToken() — JWT cookie (7 days)
     → return { user: AuthUser }
```

### Wallet sync behavior

On every `POST /auth/privy/session`:
- Embedded Privy wallets are marked `wallet_kind = 'embedded'`
- External wallets (MetaMask etc.) are marked `wallet_kind = 'external'`
- External wallets are listed **first** (wallet-first identity)
- First wallet linked becomes `is_primary = true`
- Wallets removed from Privy are soft-removed (`source = 'privy_sync'` only)

### Primary wallet

`users.wallet_address` = denormalized primary (first linked). `user_wallets.is_primary` = canonical primary per user. Multiple users can share the same wallet address.

---

## Access gates (frontend)

| Level | Requirement | Used for |
|-------|-------------|----------|
| 0 | None | Browse markets |
| 1 | Signed in + linked wallet | Trade (`useTradeAccessGate`) |
| 2 | Level 1 + KYC approved | Sell / vault (`useSellAccessGate`) |

Gates open modals in sequence: sign-in → connect-wallet → KYC.

---

## KYC

Stored on `users.kyc_status`: `none` | `pending` | `approved` | `rejected`.

Provider: **Sumsub** (`kyc_provider = 'sumsub'`). Applicant id: `users.kyc_external_id`.

Audit trail in `user_kyc_events` (append-only). Updated via:
- `POST /api/webhooks/sumsub` — Sumsub `applicantReviewed` / pending events (HMAC)
- `UserService.updateKycStatus()` (admin action)
- Admin UI: `/marketplace/admin/users` — KYC fields, event log, `POST …/users/:id/kyc` override

User-facing flow:
- `GET /api/kyc/status` — JWT
- `POST /api/kyc/access-token` — JWT; creates applicant + WebSDK token
- Frontend `/kyc` — Sumsub WebSDK 2.0

Product gates (Level 2): vault ship / mint and physical redeem require `kyc_status = approved`. Signup, Markets buy/bid, and list-for-sale do not. Server enforces KYC on mint + `POST /api/rwa/redeem-request`.

See [guides/sumsub-kyc.md](../guides/sumsub-kyc.md).

---

## Related Environment Variables

| Variable | Purpose |
|----------|---------|
| `PRIVY_APP_ID` | Privy App ID — same as `NEXT_PUBLIC_PRIVY_APP_ID` |
| `PRIVY_APP_SECRET` | Privy server secret — required |
| `PRIVY_JWT_VERIFICATION_KEY` | Optional PEM public key — skips JWKS fetch |
| `JWT_SECRET` | Session JWT signing |
| `JWT_EXPIRES_SEC` | Session TTL (default: 604800 = 7 days) |
| `SUMSUB_APP_TOKEN` | Sumsub app token (server only) |
| `SUMSUB_SECRET_KEY` | Sumsub API + webhook HMAC (server only) |
| `SUMSUB_LEVEL_NAME` | Sumsub verification level name |
| `SUMSUB_WEBHOOK_SECRET` | Optional webhook-only secret |
| `SUMSUB_BASE_URL` | Optional Sumsub API base (default `https://api.sumsub.com`) |
| `FRONTEND_URL` | Used for redirects and cookie Secure flag |
| `COOKIE_SECURE` | Override: `true` forces Secure cookie |
