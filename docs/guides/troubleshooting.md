# Troubleshooting

## Backend restart loop: `Cannot find module '/app/dist/main.js'`

**Symptom:** `tokenable-backend` is `Restarting`, nginx returns **502**, `/api/health` fails.

**Cause:** Nest compiled with a project-root `rootDir` (e.g. `scripts/*.ts` included), so the entrypoint landed at `dist/src/main.js` while the container CMD expected `dist/main.js`.

**Prevention (repo):**
- `backend/tsconfig.build.json` includes only `src/**/*`
- `backend/Dockerfile` fails the image build unless `dist/main.js` exists
- Backend CI runs `pnpm build` and asserts `dist/main.js`

**Emergency on EC2 (current broken image only):**
```bash
cd ~/app
cat > /tmp/backend-cmd.yml <<'EOF'
services:
  backend:
    command: ["node", "dist/src/main.js"]
EOF
docker-compose -f docker-compose.yml -f docker-compose.ec2.yml -f /tmp/backend-cmd.yml \
  up -d --force-recreate --no-deps backend
docker logs tokenable-backend --tail 80
docker inspect tokenable-backend --format '{{json .Config.Cmd}}'
curl -sS http://127.0.0.1/api/health
```

After a fixed image is pushed to ECR, redeploy without the override file.

---

## PSA `/api/psa/analyze` returns 500 on deployed server

1. Check backend logs for `PSA analyze failed:`:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.ec2.yml logs -f backend --tail=200
   ```

2. **`sharp` native module** — The Dockerfile uses `node:22-bookworm-slim` (Debian) to avoid Alpine (musl) incompatibility:
   ```bash
   docker exec tokenable-backend node -e "require('sharp'); console.log('ok')"
   ```

3. **Out of memory (OOM)** — PSA image processing is memory-intensive. Upgrade to `t3.medium` or set Docker memory limits.

4. **Outbound HTTPS blocked** — PSA API, Cardhedger, and IPFS gateway requests must reach the internet. Check EC2 security group outbound rules.

5. **Upload size** — Nginx `client_max_body_size` must be ≥ 15 MB. Multer limit is 15 MB (`psa.controller.ts`).

---

## Cardhedger price looks wrong (Base vs parallel)

- **Symptom:** Price is much lower than the market for the same card # (e.g. ~$400 vs ~$3k on a Silver slab).
- **Cause:** PSA **Variety** was not stored in IPFS `graded.psa`, so resolution locked to Cardhedger **Base** `card_id`.
- **Fix:** Ensure mint JSON includes `graded.psa.Variety`; keep `PSA_PUBLIC_API_TOKEN` so cert lookup can backfill Variety for older metadata. Details: **[cardhedger-psa-variety.md](cardhedger-psa-variety.md)**.

---

## Login modal does not open / Privy session not created

**Symptom:** Clicking "Sign in" has no effect, or `POST /api/auth/privy/session` returns `400 Bad Request`.

**Console: `POST https://auth.privy.io/api/v1/sessions` → 500**

Privy’s own session restore failed (often a stale refresh token, sometimes a Privy outage). While that happens Privy never becomes `ready`, so `login()` does nothing even if **Sign up** is visible.

1. DevTools → Application → clear site data for the origin, then reload.
2. Confirm [status.privy.io](https://status.privy.io) and Dashboard **Allowed domains** include the exact origin (`http://localhost:3000` or `https://tokenable-dev.com`).

Unrelated noise: `THREE.Clock` deprecation (home 3D) and `contentscript.js` / `ObjectMultiplex` (wallet browser extension) do **not** block Sign up.

**Local dev**

1. Verify `NEXT_PUBLIC_PRIVY_APP_ID` is set in `frontend/.env` and the dev server was restarted after adding it (Next.js bakes `NEXT_PUBLIC_*` at startup).
2. Verify `PRIVY_APP_ID` and `PRIVY_APP_SECRET` are set in `backend/.env`.
3. Confirm `localhost:3000` is listed in the **Allowed domains** in the [Privy Dashboard](https://dashboard.privy.io/).
4. Check backend logs: `pnpm start:dev` — look for `Privy auth is not configured` or token verification errors.

**Deployed server (EC2)**

1. **Frontend:** GitHub secret `NEXT_PUBLIC_PRIVY_APP_ID` must be set and a **new** deploy must run (value is baked into the Docker image — editing EC2 env alone does not update the frontend bundle).
2. **Backend:** `/home/ubuntu/.env.production.backend` must include `PRIVY_APP_ID` (same App ID) and `PRIVY_APP_SECRET`. Recreate backend after editing:  
   `docker compose -f docker-compose.yml -f docker-compose.ec2.yml up -d --force-recreate backend`
3. **Privy Dashboard → Domains:** add `https://your-production-domain.com` (exact scheme + host).
4. **`FRONTEND_URL` / `CORS_ORIGIN`:** must match the URL users open in the browser (HTTPS in production).
5. **`SITE_ACCESS_ENABLED=true`:** complete `/site-access` first — most API routes (including `POST /api/auth/privy/session`) require the `site_access` cookie.
6. **Cookies:** after login, DevTools → Application → Cookies should show `access_token` (HttpOnly). If missing, check `COOKIE_SECURE=true` when using HTTPS.

See [deployment.md](./deployment.md#privy-on-deploy-login--wallet--not-fiat-pay).

---

## Frontend API calls return 401

- Check that `access_token` cookie is present in the browser (DevTools → Application → Cookies).
- Google OAuth callback URL must match exactly what is registered in Google Cloud Console.
- `FRONTEND_URL` in backend env must match the URL the user opens in the browser.
- If response includes `"code":"SITE_ACCESS_REQUIRED"`, complete **`/site-access`** first when `SITE_ACCESS_ENABLED=true` — see [site-access.md](../api/site-access.md).

---

## API calls go to the wrong host (CORS errors or wrong IP)

- `NEXT_PUBLIC_API_URL` is baked into the bundle at Docker build time. If it was set to an IP that has changed, rebuild and redeploy the frontend image.
- For same-origin proxying, leave `NEXT_PUBLIC_API_URL` **empty** — `getApiUrl()` will use `window.location.origin + "/api"` automatically.

---

## Containers start but frontend shows blank page

1. Check frontend logs: `docker logs tokenable-frontend --tail=50`
2. Verify `NEXT_PUBLIC_CHAIN_11155111_RPC_URL`, `_RWA`, and `_USDC` were provided as build args — the frontend Dockerfile validates these at build time.
3. Force a hard refresh (Ctrl+Shift+R / Cmd+Shift+R) to bypass stale Service Worker cache.

---

## Deploy finished but UI still looks like an older revision

GitHub Actions deploys frontend and backend from the **same commit** when you push `develop` (or `main`). If the site differs from local:

1. Confirm the Actions run is for the commit you expect (SHA on the workflow run).
2. Try a private window or cache-bypass refresh.
3. Confirm you are opening the **dev** URL that maps to the EC2 stack from this repo (not a separate preview host).
4. See **[deployment.md](deployment.md)** for image tags (`develop` / `main`) and verification steps.

---

## Database: "relation does not exist"

Production expects **seventeen** application tables — see [architecture/database.md](../architecture/database.md). Apply bootstrap once:

```bash
# From repo root (host has backend/sql/)
docker exec -i tokenable-postgres env PGPASSWORD=tokenable \
  bash -s < backend/sql/scripts/bootstrap-db.sh

docker exec tokenable-postgres psql -U tokenable -d tokenable -c '\dt'
```

Then set `TYPEORM_SYNC=false` in `.env.production.backend` and restart the backend.

---

## Markets list empty but orders exist

Collections are created on **first ask listing**, not at mint. Check:

```bash
docker exec tokenable-postgres psql -U tokenable -d tokenable -c \
  "SELECT COUNT(*) FROM marketplace_collections;"
docker exec tokenable-postgres psql -U tokenable -d tokenable -c \
  "SELECT token_id, collection_key FROM orders WHERE side='ask' AND status='active';"
```

- `collection_key` NULL → listing metadata missing graded bucket fields; see orphan route `/marketplace/other-listings`.
- List API OK but UI empty → hard refresh; check `GET /api/marketplace/collections`.
- Snapshot bar stuck → `POST /api/marketplace/collections/market-snapshots` errors in Network tab.

---

## Mint rejected: "PSA 10 only"

Vault allows preview for any PSA grade; **mint** requires grade **10** in graded metadata. Non–PSA-10 certs (e.g. PSA 9 Jordan) will fail at `POST /api/rwa/upload`.

---

## PSA cert lookup shows wrong card or empty grade

- **Cert-only mode** (`POST /api/psa/analyze-by-cert`): uses your cert exactly; PSA response must match (`PSACert.CertNumber` = request) or API returns 400.
- **Slab photo mode**: Cardhedger cert OCR runs **before** manual cert hint — wrong OCR cert can drive PSA lookup. Prefer cert-only for a known cert number.
- Empty **Grade** dropdown: ensure backend parses `CardGrade` / `GradeDescription` from PSA (recent builds); redeploy if needed.

---

## `/vault/submit/mint` — `POST /api/psa/analyze-by-cert` fails with 429

**Symptom:** Cert lookup returns **429** `PSA_RATE_LIMIT_EXCEEDED`; backend log shows  
`PSA upstream 429 cert=…`.

**Cause:** PSA Public API upstream rate-limited the token(s) in `PSA_PUBLIC_API_TOKENS` / `PSA_PUBLIC_API_TOKEN`. Tokenable does not locally block tokens after 429.

**Fix:** Wait for PSA’s daily reset / `Retry-After`, add another PSA token to the pool and restart backend, or request a higher quota from PSA. Details: [api/psa.md](../api/psa.md#rate-limits).

---

## Add funds / MoonPay console errors (Sepolia sandbox)

| Console / UI | Meaning |
|--------------|---------|
| `Transaction not found` / `PrivyApiError` after cancel or incomplete checkout | Privy polls fiat tx status; common in sandbox — ignore if modal opened |
| `fiat/status?provider=moonpay-sandbox` **400** | Same family — often benign |
| `Buy 0X1C7D4…` + Stripe error | `destination.asset` must be `"usdc"` (symbol), not contract address |

Setup: [privy-wallet-funding.md](privy-wallet-funding.md).

---

## Cardhedger routes return errors

- Verify `CARDHEDGER_API_KEY` is set in the backend environment.
- Check rate limits — Cardhedger may throttle requests under heavy load.

---

## `pnpm install` fails with `ERR_PNPM_OUTDATED_LOCKFILE`

This happens when `CI=1` is set in the environment, which enables `--frozen-lockfile` by default:

```bash
pnpm install --no-frozen-lockfile
```

---

## Local dev: `net::ERR_CONTENT_DECODING_FAILED` on API responses

**Symptom:** Browser DevTools shows `GET /api/marketplace/collections … net::ERR_CONTENT_DECODING_FAILED 200 (OK)`. Marketplace data does not load.

**Cause:** The NestJS backend uses `compression()` middleware which GZIP-compresses responses. Node.js's `fetch` (undici) in the Next.js dev API proxy automatically decompresses the body — but the `Content-Encoding: gzip` response header was still forwarded to the browser, which then tried to decompress an already-decompressed body.

**Fix (already applied):** `frontend/lib/core/apiDevProxy.ts` now strips `content-encoding` and `content-length` headers from proxied responses:

```ts
responseHeaders.delete("content-encoding");
responseHeaders.delete("content-length");
```

If you see this error again, ensure you are running the latest frontend code. A browser hard-refresh (⌘⇧R) after a frontend restart clears any cached state.

---

## Local dev: API empty / `curl localhost:4000/api/health` hangs

**Symptom:** UI shows no marketplace data; `curl http://127.0.0.1:4000/api/health` times out; Postgres still has rows; backend logs show SQL running.

**Cause:** Cursor / VS Code **Ports** panel can bind `localhost:4000` for remote/tunnel forwarding. That listener wins over Nest on `127.0.0.1`, while Next.js dev rewrites `/api` → `http://127.0.0.1:4000` (see `frontend/lib/core/backendOrigin.ts`). Browser and SSR calls then hit the IDE tunnel, not the API.

**Verify:**

```bash
lsof -i :4000 | head -5
curl -s --max-time 3 http://127.0.0.1:4000/api/health
# expect {"ok":true,"service":"tokenable-api",...}
```

**Fix:** Local dev defaults to Nest on **`127.0.0.1:4100`**. Next dev probes **4100 then 4000** via `app/api/[...path]/route.ts` (no `.env.local`). Restart both backend and frontend. If `backend/.env` has `PORT=4000`, use `4100` instead.


---

## Quick Inspection Commands

```bash
# Container status
docker compose -f docker-compose.yml -f docker-compose.ec2.yml ps

# Backend logs
docker logs tokenable-backend 2>&1 | tail -80

# Check env vars in backend container
docker exec tokenable-backend env | grep -E 'TYPEORM|POSTGRES|NODE_ENV|CARDHEDGER'

# Verify DB tables (see architecture/database.md for full list)
docker exec tokenable-postgres psql -U tokenable -d tokenable -c '\dt'

# Portfolio cron log (after 09:00 KST or bootstrap)
docker logs tokenable-backend 2>&1 | grep portfolio_daily_snapshot

# API smoke tests
curl -s http://localhost:4000/api/auth/session
curl -s http://localhost:4000/api/marketplace/collections
```
