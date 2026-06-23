# Auth API

**Controller:** `backend/src/auth/auth.controller.ts`  
**Base path:** `/api/auth`  
**Swagger tag:** `auth`

Authentication supports **Google OAuth 2.0** and **email/password**. After sign-in, the backend issues a JWT as an `HttpOnly` cookie (`access_token`). Protected routes accept either the cookie or `Authorization: Bearer <token>`.

---

## Routes

### `POST /api/auth/register`

Create an account with email and password.

- **Request body:**

```json
{ "email": "you@example.com", "password": "at-least-8-chars", "name": "Optional" }
```

- **Response:** `200 { "ok": true, "email": "...", "message": "..." }` — **no JWT cookie** until email is verified
- **Side effect:** Creates `verification_tokens` row (SHA-256 hash) and sends raw token by email
- **Errors:**
  - `409` — email already registered (Google-only accounts get a message to use Google sign-in)

---

### `POST /api/auth/login`

Sign in with email and password.

- **Request body:**

```json
{ "email": "you@example.com", "password": "your-password" }
```

- **Response:** `200 { "user": { ... } }` and `access_token` cookie
- **Errors:**
  - `401` — invalid credentials, Google-only account, or **`email_verified = false`**

---

### `GET /api/auth/google`

Initiates Google OAuth. Passport redirects the browser to Google.

- **Guard:** `AuthGuard('google')`
- **Response:** `302` redirect to Google

---

### `GET /api/auth/google/callback`

Google OAuth callback. Issues JWT cookie and redirects to the frontend.

- **Guard:** `AuthGuard('google')`
- **Cookie set:** `access_token` (HttpOnly, maxAge 7 days)
  - `Secure` flag: `true` when `FRONTEND_URL` starts with `https://` or `COOKIE_SECURE=true`
- **Redirect:** `{FRONTEND_URL}/auth/callback?ok=1`
- **Account linking:** If the Google email matches an existing email/password account, `google_id` is linked to the same `users` row.

---

### `GET /api/auth/verify-email`

Handles the email-verification link sent to the user's inbox.

| Query param | Required | Description |
|-------------|----------|-------------|
| `token` | Yes | One-time verification token (raw; stored hashed in `verification_tokens`) |

- **On success:** `users.email_verified = true`, all `verification_tokens` for user deleted
- **Response:** Redirects to `{FRONTEND_URL}/?email_verify=ok|invalid|expired|missing`

---

### `POST /api/auth/send-verification-email`

Resends the verification email (authenticated).

- **Guard:** `JwtAuthGuard` (cookie or Bearer)
- **Rate limit:** 60s between sends per user
- **Response:** `200 { ok: true }`

---

### `POST /api/auth/resend-verification-email`

Resends the verification email by email address (no login required).

- **Request body:** `{ "email": "you@example.com" }`
- **Rate limit:** 60s between sends per user
- **Response:** `200 { ok: true }` (always, to avoid email enumeration)

---

### `GET /api/auth/session`

Returns the current session user. Never returns `401`; unauthenticated requests get `{ user: null }`.

```json
// authenticated
{ "user": { "id": "...", "email": "...", "emailVerified": true, "walletAddress": "0x...", ... } }

// unauthenticated
{ "user": null }
```

---

### `GET /api/auth/me`

Returns the current user. Returns `401` when unauthenticated.

- **Guard:** `JwtAuthGuard`
- **Response:** Same user shape as `session.user`

---

### `POST /api/auth/logout`

Clears the `access_token` cookie.

- **Response:** `204 No Content`

---

### `GET /api/auth/wallet/challenge`

Issues a short-lived JWT challenge for wallet linking (requires signature).

- **Guard:** `JwtAuthGuard`
- **Response:** `{ "message": "...", "challenge": "..." }`

---

### `POST /api/auth/wallet`

Links an Ethereum wallet address to the authenticated account. Requires a valid `personal_sign` over the challenge message.

- **Guard:** `JwtAuthGuard`
- **Request body:** `LinkWalletDto`

```json
{ "address": "0xYourEthereumAddress", "signature": "0x...", "challenge": "..." }
```

- **Response:**

```json
{ "id": "...", "walletAddress": "0x...", "walletLinkedAt": "2024-01-01T00:00:00.000Z" }
```

---

### `DELETE /api/auth/wallet`

Unlinks the wallet address from the authenticated account.

- **Guard:** `JwtAuthGuard`
- **Response:** `{ "walletAddress": null }`

---

## Account linking (same email)

| Scenario | Behavior |
|----------|----------|
| Google first → email/password register | `409` — use Google sign-in |
| Email/password first → Google login | Same `users` row; `google_id` attached |
| Email/password login on Google-only account | `401` — use Google sign-in |

---

## Related Environment Variables

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | Public URL — must match Google Console. Use **`{FRONTEND_URL}/api/auth/google/callback`** (Next dev proxy), not the Nest listen port (`4100` in dev). |
| `FRONTEND_URL` | Frontend base URL used for redirects and cookie Secure flag |
| `JWT_SECRET` | JWT signing secret |
| `COOKIE_SECURE` | Optional override: `true` / `false` |
