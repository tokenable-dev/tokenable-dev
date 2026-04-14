# EC2 (Docker): public IP + custom domain

Single **t3.small** with **Nginx → Next (3000) + Nest (4000)**. Best default: **the browser always calls `/api` on whatever host the user opened** (same origin). Then **IP and domain work without rebuilding the frontend**, and you avoid **HTTPS page → HTTP API** mixed content.

## Same-origin `/api` (recommended)

- Nginx proxies `/api` to the Nest container (`nginx/nginx.conf`).
- In the browser, `getApiUrl()` uses `window.location.origin + '/api'` when `NEXT_PUBLIC_API_URL` is unset (`frontend/lib/api.ts`).
- SSR uses `INTERNAL_API_URL=http://backend:4000/api` in `docker-compose.yml`.

### What to do

1. **CI / local image build:** leave **`NEXT_PUBLIC_API_URL` empty** or remove the GitHub secret. The workflow only passes `--build-arg NEXT_PUBLIC_API_URL=...` when the secret is non-empty (`.github/workflows/deploy.yml`).
2. If you previously baked `NEXT_PUBLIC_API_URL=http://<ip>/api`, **rebuild and redeploy** so the bundle stops hard-coding the IP.

### When to set `NEXT_PUBLIC_API_URL`

Only if the browser must talk to an API on **another host**, e.g. `https://api.example.com/api`.

## CORS

If all browser traffic goes through Nginx to `/api`, CORS rarely matters. If you use extra origins (tools, another dev URL), set a comma list in `/home/ubuntu/.env.production.backend`:

```env
CORS_ORIGIN=http://54.x.x.x,http://tokenable-dev.com,https://tokenable-dev.com,http://www.tokenable-dev.com,https://www.tokenable-dev.com
```

Prefer an explicit list in production instead of `CORS_ORIGIN=*` with credentials.

## OAuth, redirects, cookies

Match **the URL users actually type** in the address bar.

- **`GOOGLE_CALLBACK_URL`** — public URL, e.g. `https://tokenable-dev.com/api/auth/google/callback`. If you also log in via raw IP, add the `http://<ip>/api/auth/google/callback` variant in Google Cloud Console.
- **`FRONTEND_URL`** — frontend base URL used for redirects; keep consistent with your primary entry (often `https://your-domain`).
- **Cookie `Secure`** — backend derives behavior from `FRONTEND_URL` and related settings. Supporting **both** `https://domain` and `http://ip` for OAuth can be awkward; prefer **one canonical URL + HTTPS** when you can.

## DNS and TLS

- Point the domain **A record** at the instance public IP.
- Terminate **HTTPS on Nginx** (`443` is already mapped in `docker-compose.yml`). Use Certbot **webroot** with `/.well-known/acme-challenge/` (see `nginx/nginx.conf`).

**Git vs server:** The repo keeps **`nginx/nginx.conf`** as **HTTP only** (port 80 + ACME + proxy). After `certbot certonly` succeeds, point Compose at the TLS template **without overwriting tracked files**: in **`~/app/.env`** (gitignored) add `NGINX_CONF=./nginx/nginx.tls.conf`, then recreate Nginx. Default when unset is `./nginx/nginx.conf` (`docker-compose.yml` uses `${NGINX_CONF:-./nginx/nginx.conf}`). Adjust `server_name` and certificate paths in `nginx/nginx.tls.conf` if your domain differs from `tokenable-dev.com`.

`X-Forwarded-Proto` is already passed to the backend so it can infer the client scheme.

## Post-deploy checklist

- [ ] Network tab: API calls go to `https://<domain>/api/...` or `http://<ip>/api/...`, not a mismatched host/scheme.
- [ ] Frontend image built **without** `NEXT_PUBLIC_API_URL` unless you intentionally use a separate API host.
- [ ] `CORS_ORIGIN` lists every frontend origin you use.
- [ ] IdP **Authorized redirect URIs** match real URLs.
- [ ] `FRONTEND_URL` and `GOOGLE_CALLBACK_URL` match your chosen entry points.

## Related files

| File | Role |
|------|------|
| `frontend/lib/api.ts` | Browser vs SSR API base URL |
| `frontend/Dockerfile` | `NEXT_PUBLIC_*` build args |
| `.github/workflows/deploy.yml` | Optional `NEXT_PUBLIC_API_URL` build-arg |
| `docker-compose.yml` | `INTERNAL_API_URL`, Nginx ports |
| `nginx/nginx.conf` | HTTP + ACME + `/api` → backend (Git); HTTPS template: `nginx/nginx.tls.conf` |
| `backend/src/main.ts` | `CORS_ORIGIN` |
| `backend/src/auth/*` | `FRONTEND_URL`, `GOOGLE_CALLBACK_URL`, cookies |
