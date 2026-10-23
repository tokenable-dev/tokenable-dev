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

When `SITE_ACCESS_ENABLED=true` (local `.env` included), every host asks for the password. `app.tokenable.io` and `tokenable-dev.com` (including `www`) ask even if that flag is off. The KBW event window does **not** skip this gate.

KBW `/event` and the mystery-card offer still work after the visitor passes this gate (password → `site_access` cookie). The event window does **not** bypass the gate.

**Marketplace admin:** `/marketplace/admin` and `/api/marketplace/admin/auth/*` skip the site-access redirect so operators can open the admin login without entering `717171` first. Successful admin login (and an authenticated `GET …/auth/session`) also mints/refreshes the `site_access` cookie, so admin data APIs work without a prior `/site-access` visit.

---

## Routes

### `POST /api/site-access/verify`

Verify the site-access password and set an HttpOnly cookie.

- **Body:** `{ "password": "..." }`
- **Success:** Sets `site_access` cookie (signed with `SITE_ACCESS_SECRET`)
- **Failure:** `401`

This path is always public (exempt from the gate).

### `GET /api/site-access/status` (Next.js only)

Read-only gate state for the browser (`enabled` / `granted`). Implemented in `frontend/app/api/site-access/status/route.ts`. **Nginx must proxy this path to the frontend container**, not Nest — otherwise clients get `404` and onboarding modals can misbehave. See `nginx/nginx.tls.conf` `location = /api/site-access/status`.

---

## Middleware behavior

`SiteAccessMiddleware` runs on all `/api/*` requests when enabled.

**Public paths (no cookie required):**

| Path | Method |
|------|--------|
| `/api/site-access/verify` | POST |
| `/api/health` | GET |
| `/api/webhooks/cardhedger/price-updates` | POST |
| Auth public paths | `GET /api/auth/session`, `POST /api/auth/privy/session`, `POST /api/auth/logout` (`isAuthPublicApiPath`) |
| Admin auth | `GET /api/marketplace/admin/auth/session`, `POST …/login`, `POST …/logout` |
| Swagger paths | per `site-access-swagger.util.ts` |

Next.js page proxy also allows `/marketplace/admin` (and subpaths) without a prior site-access cookie.

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
