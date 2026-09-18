# Networking, CORS & TLS

## Same-Origin Proxying (Recommended)

The recommended production setup routes all browser traffic through Nginx on the same host. This way the frontend bundle needs no hard-coded API URL, and the same image works with both IP access and domain access.

```
Browser → Nginx (port 80/443)
  /api/*  →  NestJS backend (port 4000)
  /*      →  Next.js frontend (port 3000)
```

### How it works

- `frontend/lib/core/api.ts`: `getApiUrl()` uses `window.location.origin + "/api"` when `NEXT_PUBLIC_API_URL` is unset.
- SSR (Next.js server-side): uses `INTERNAL_API_URL=http://backend:4000/api` (set in `docker-compose.yml`).
- Nginx config: `nginx/nginx.conf` proxies `/api` to the backend container.

### When to set `NEXT_PUBLIC_API_URL`

Only set this when the browser must reach an API on a **different host**, e.g. `https://api.example.com/api`.  
For the standard single-host setup, leave it empty.

---

## CORS

CORS is only relevant when frontend and API are on different origins (e.g. dev tool, separate subdomain).

In `backend/src/main.ts`:
- `CORS_ORIGIN=*` → allows all origins (avoid with credentials in production)
- `CORS_ORIGIN=https://tokenable-dev.com,http://54.x.x.x` → explicit allowlist

Set `CORS_ORIGIN` in `/home/ubuntu/.env.production.backend`:

```env
CORS_ORIGIN=http://54.x.x.x,https://tokenable-dev.com,https://www.tokenable-dev.com
```

---

## Cookies

Google OAuth login and SMTP mail were removed. Login is Privy. Gmail polling uses `GMAIL_*`, not `GOOGLE_CLIENT_*`.

| Variable | Purpose |
|----------|---------|
| `FRONTEND_URL` | Frontend base URL — cookie `Secure` flag |
| `COOKIE_SECURE` | Override cookie `Secure` flag: `true` / `false`. Default: derived from `FRONTEND_URL` scheme |

**Rule:** `Secure=true` is automatically set when `FRONTEND_URL` starts with `https://`. Override with `COOKIE_SECURE=false` for HTTP + IP access.

Prefer one canonical HTTPS entry point.

---

## DNS & TLS

1. Point the domain **A record** to the EC2 public IP.
2. The `nginx/nginx.conf` already handles HTTP + ACME challenge.
3. Run Certbot (separate lineage per hostname — do **not** expand the existing `tokenable-dev.com` cert):
   ```bash
   certbot certonly --webroot -w /home/ubuntu/app/certbot/www -d tokenable-dev.com -d www.tokenable-dev.com
   certbot certonly --webroot -w /home/ubuntu/app/certbot/www -d app.tokenable.io
   ```
4. Set HTTPS template without overwriting tracked files. In `/home/ubuntu/app/.env` (gitignored):
   ```env
   NGINX_CONF=./nginx/nginx.tls.conf
   ```
5. `nginx/nginx.tls.conf` has separate `server` blocks for `tokenable-dev.com` / `www` and `app.tokenable.io` (each with its own LE paths). After editing, `docker exec tokenable-nginx nginx -t` then `nginx -s reload` (or recreate nginx only).
6. Recreate only if reload is not enough:
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.ec2.yml up -d --no-deps --force-recreate nginx
   ```

`X-Forwarded-Proto` is forwarded to the backend so it can infer the client scheme.

---

## Post-Deploy Checklist

- [ ] Network tab: API calls go to `https://<domain>/api/...` or `http://<ip>/api/...` — not a mismatched host/scheme
- [ ] Frontend image built **without** `NEXT_PUBLIC_API_URL` (same-origin setup)
- [ ] `CORS_ORIGIN` lists every frontend origin
- [ ] `FRONTEND_URL` is the canonical HTTPS origin (sets the session cookie `Secure` flag)

---

## Related Files

| File | Role |
|------|------|
| `frontend/lib/core/api.ts` | `getApiUrl()` — browser vs SSR base URL |
| `frontend/Dockerfile` | `NEXT_PUBLIC_*` build args |
| `docker-compose.yml` | `INTERNAL_API_URL`, Nginx port mapping |
| `nginx/nginx.conf` | HTTP + ACME + `/api` proxy (git-tracked) |
| `nginx/nginx.tls.conf` | HTTPS template (not git-tracked) |
| `backend/src/main.ts` | CORS, cookie config |
| `backend/src/auth/auth.controller.ts` | Cookie `Secure` flag logic |
