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

Production expects four tables — see [architecture/database.md](../architecture/database.md). Apply bootstrap once:

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

# Verify DB tables (expect 4: users, marketplace_collections, collection_market_snapshots, orders)
docker exec tokenable-postgres psql -U tokenable -d tokenable -c '\dt'

# API smoke tests
curl -s http://localhost:4000/api/auth/session
curl -s http://localhost:4000/api/marketplace/collections
curl -s http://localhost:4000/api/cardhedger/indexes
```
