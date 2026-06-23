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
- **Email/password accounts:** If the user registered with email/password but has not clicked the verification link (`email_verified = false`), Google sign-in does **not** issue a JWT — redirect includes `?error=...` instead. Google-only accounts (no password) are signed in normally.

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

The same wallet may be linked to multiple platform accounts (e.g. shared custody). Uniqueness is per `(user, address)` only.

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
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Email verification (register / resend) |
| `MAIL_FROM` | Sender address — use an address on your **verified sending domain** |
| `MAIL_FROM_NAME` | Display name in inbox (default: `Tokenable`) |
| `MAIL_REPLY_TO` | Optional reply-to (defaults to `MAIL_FROM`) |

### Email verification template

Verification emails are sent in **English** with branded HTML (inline T icon via CID attachment when available, white wordmark, CTA button, plain-text fallback). Asset: `backend/src/assets/mail/tokenable_icon.png` (same favicon as the site). Template: `backend/src/mail/templates/verification-email.template.ts`.

### Reducing spam folder delivery

Code changes (bilingual subject removal, HTML+text, `From` display name, `Reply-To`) help, but **inbox placement is mostly DNS and sender reputation**:

1. **Align the From domain** — `MAIL_FROM` should match your site domain (e.g. `noreply@tokenable-dev.com`), not a personal Gmail, when sending from production.
2. **SPF, DKIM, DMARC** — Add DNS records for the domain you send from. Gmail SMTP with `@gmail.com` only helps Gmail-to-Gmail; custom-domain From without matching DNS often lands in spam.
3. **Transactional provider (recommended)** — [Resend](https://resend.com), SendGrid, Amazon SES, or Postmark on `tokenable-dev.com` with verified domain + DKIM.
4. **Warm up** — New domains/senders start with lower trust; avoid burst sends.
5. **Ask users** — “Mark as not spam” once improves future delivery for that mailbox.

Until DNS is fixed, some messages may still hit spam even with the new template.
