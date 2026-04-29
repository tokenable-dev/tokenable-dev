# Auth API

**Controller:** `backend/src/auth/auth.controller.ts`  
**Base path:** `/api/auth`  
**Swagger tag:** `auth`

Authentication uses **Google OAuth 2.0**. After the callback, the backend issues a JWT as an `HttpOnly` cookie (`access_token`). Protected routes accept either the cookie or `Authorization: Bearer <token>`.

---

## Routes

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
- **Side effect:** Queues verification email if user's email is not yet verified

---

### `GET /api/auth/verify-email`

Handles the email-verification link sent to the user's inbox.

| Query param | Required | Description |
|-------------|----------|-------------|
| `token` | Yes | One-time verification token |

- **Response:** Redirects to `{FRONTEND_URL}/?email_verify=ok` or `?email_verify=invalid`

---

### `POST /api/auth/send-verification-email`

Resends the verification email.

- **Guard:** `JwtAuthGuard` (cookie or Bearer)
- **Response:** `200 { ok: true }`

---

### `GET /api/auth/session`

Returns the current session user. Never returns `401`; unauthenticated requests get `{ user: null }`.

```json
// authenticated
{ "user": { "id": "...", "email": "...", "name": "...", "walletAddress": "0x...", ... } }

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

### `POST /api/auth/wallet`

Links an Ethereum wallet address to the authenticated account. The address is normalized to EIP-55 checksum format.

- **Guard:** `JwtAuthGuard`
- **Request body:** `LinkWalletDto`

```json
{ "address": "0xYourEthereumAddress" }
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

## Related Environment Variables

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | Public URL — must match Google Console (`{host}/api/auth/google/callback`) |
| `FRONTEND_URL` | Frontend base URL used for redirects and cookie Secure flag |
| `JWT_SECRET` | JWT signing secret |
| `COOKIE_SECURE` | Optional override: `true` / `false` |
