# Site Access Gate

**Module:** `backend/src/site-access/`  
**Base path:** `/api/site-access`

Optional **staging password gate** that blocks API access until the visitor submits a shared password. Used to protect pre-release deployments without changing auth flows.

---

## Enable

```env
SITE_ACCESS_ENABLED=true
SITE_ACCESS_SECRET=your-long-random-secret
```

When disabled (default), middleware is a no-op.

---

## Routes

### `POST /api/site-access/verify`

Verify the site-access password and set an HttpOnly cookie.

- **Body:** `{ "password": "..." }`
- **Success:** Sets `site_access` cookie (signed with `SITE_ACCESS_SECRET`)
- **Failure:** `401`

This path is always public (exempt from the gate).

---

## Middleware behavior

`SiteAccessMiddleware` runs on all `/api/*` requests when enabled.

**Public paths (no cookie required):**

| Path | Method |
|------|--------|
| `/api/site-access/verify` | POST |
| `/api/health` | GET |
| `/api/webhooks/cardhedger/price-updates` | POST |
| Auth public paths | per `auth-oauth.util.ts` (Google OAuth, register, login, verify-email, forgot/reset password) |
| Swagger paths | per `site-access-swagger.util.ts` |

All other API calls without a valid `site_access` cookie return:

```json
{
  "statusCode": 401,
  "message": "Site access password required",
  "code": "SITE_ACCESS_REQUIRED"
}
```

---

## Frontend

Route: **`/site-access`** (`frontend/app/site-access/page.tsx`)

User enters password → `POST /api/site-access/verify` → cookie set → redirect to app.

---

## Production notes

- Use a strong `SITE_ACCESS_SECRET` (distinct from `JWT_SECRET`).
- Gate is independent of user JWT — both may be required on staging.
- Cardhedger price webhooks must remain public so upstream can POST without the gate cookie.
