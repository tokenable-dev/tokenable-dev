# Troubleshooting

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

## Frontend API calls return 401

- Check that `access_token` cookie is present in the browser (DevTools → Application → Cookies).
- Google OAuth callback URL must match exactly what is registered in Google Cloud Console.
- `FRONTEND_URL` in backend env must match the URL the user opens in the browser.

---

## API calls go to the wrong host (CORS errors or wrong IP)

- `NEXT_PUBLIC_API_URL` is baked into the bundle at Docker build time. If it was set to an IP that has changed, rebuild and redeploy the frontend image.
- For same-origin proxying, leave `NEXT_PUBLIC_API_URL` **empty** — `getApiUrl()` will use `window.location.origin + "/api"` automatically.

---

## Containers start but frontend shows blank page

1. Check frontend logs: `docker logs tokenable-frontend --tail=50`
2. Verify `NEXT_PUBLIC_RWA_CONTRACT_ADDRESS` was provided as a build arg — the frontend Dockerfile validates this at build time.
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

TypeORM `synchronize: true` is enabled in development. In production, apply the bootstrap schema once:

```bash
docker exec -i tokenable-postgres psql -U tokenable -d tokenable \
  < /home/ubuntu/app/backend/sql/bootstrap-empty-prod-db.sql
```

Then set `TYPEORM_SYNC=false` in `.env.production.backend` and restart the backend.

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

## Quick Inspection Commands

```bash
# Container status
docker compose -f docker-compose.yml -f docker-compose.ec2.yml ps

# Backend logs
docker logs tokenable-backend 2>&1 | tail -80

# Check env vars in backend container
docker exec tokenable-backend env | grep -E 'TYPEORM|POSTGRES|NODE_ENV|CARDHEDGER'

# Verify DB tables
docker exec tokenable-postgres psql -U tokenable -d tokenable -c '\dt'

# API smoke tests
curl -s http://localhost:4000/api/auth/session
curl -s http://localhost:4000/api/marketplace/collections
curl -s http://localhost:4000/api/cardhedger/indexes
```
