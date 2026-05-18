# Deployment (EC2)

GitHub Actions builds frontend and backend Docker images, pushes them to **AWS ECR**, and SSH-deploys to **EC2** with Docker Compose. This is the default CI/CD path for this monorepo.

### Source branch (what ships)

| Branch | When you push | What runs |
|--------|----------------|-----------|
| **`develop`** | Every push | Build → ECR → **Dev EC2** (`DEV_EC2_*` secrets) — day-to-day environment; treat this branch as **current integration / deploy-from-here**. |
| **`main`** | Every push | Build → ECR → **Prod EC2** (`PROD_EC2_*` secrets), when those secrets and host are configured. |

Images are tagged with **`develop`** / **`main`** (branch pointer, always matches latest build on that branch) **and** the full **`github.sha`** (immutable). The EC2 script sets `IMAGE_TAG` to the branch name so `docker compose pull` tracks the rolling branch tag.

**Verify a deploy matched your commit:** GitHub Actions run → checkout step shows the SHA; optionally on EC2: `cd /home/ubuntu/app && git rev-parse HEAD` after `pull` matches that SHA.

---

## Infrastructure

| Component | Details |
|-----------|---------|
| Instance | AWS EC2 (t3.small recommended) |
| Nginx | Terminates HTTP/HTTPS, proxies `/api` → backend, `/` → frontend |
| Docker Compose | `docker-compose.yml` + `docker-compose.ec2.yml` |
| Container registry | AWS ECR |

---

## CI/CD Workflow

**Workflow file:** [.github/workflows/deploy.yml](../../.github/workflows/deploy.yml)

**Triggers:** Push to **`develop`** or **`main`** (same pipeline; deploy job selects host by branch).

1. **build-and-push** (always): build `tokenable-frontend` and `tokenable-backend` → push each image twice: `:develop` / `:main` (branch ref name) and `:<sha>`.
2. **deploy-dev** (if branch is `develop`): SSH to dev EC2, `git pull` `develop`, `IMAGE_TAG=develop`, compose pull/up.
3. **deploy-prod** (if branch is `main`): same for prod host with `IMAGE_TAG=main`.

Each run deploys **both** frontend and backend from the **same commit** — if the UI looks older than APIs (or vice versa), check caching or a stale preview URL, not two different SHAs from this workflow.

---

## GitHub Secrets / Variables

All of the following must be set in **Repository Secrets** (recommended) or Variables.  
`NEXT_PUBLIC_*` values are baked into the frontend bundle at Docker build time — a rebuild is required when they change.

| Name | Required | Description |
|------|----------|-------------|
| `AWS_ACCESS_KEY_ID` | Yes | ECR push credentials |
| `AWS_SECRET_ACCESS_KEY` | Yes | ECR push credentials |
| `ECR_REGISTRY` | Yes | e.g. `717728193407.dkr.ecr.ap-northeast-2.amazonaws.com` |
| `DEV_EC2_HOST` | Yes (`develop`) | Dev EC2 public IP or hostname |
| `DEV_EC2_SSH_KEY` | Yes (`develop`) | Dev SSH private key |
| `PROD_EC2_HOST` | Required for **`main`** deploy | Prod EC2 host |
| `PROD_EC2_SSH_KEY` | Required for **`main`** deploy | Prod SSH private key |
| `NEXT_PUBLIC_RWA_CONTRACT_ADDRESS` | Yes | Sepolia TokenableRWA address |
| `NEXT_PUBLIC_USDC_CONTRACT_ADDRESS` | Yes | Sepolia MockUSDC address |
| `NEXT_PUBLIC_ALCHEMY_RPC_URL` | Yes | Browser RPC URL |
| `NEXT_PUBLIC_API_URL` | No | Leave empty for same-origin Nginx proxying |
| `NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT` | No | Fee recipient address |
| `NEXT_PUBLIC_PLATFORM_FEE_BPS` | No | Fee in basis points |

---

## EC2 Setup (First Time)

```bash
# On EC2:
git clone https://github.com/<org>/tokenable-dev.git /home/ubuntu/app
```

Create `/home/ubuntu/.env.production.backend` with all backend secrets (same keys as `backend/.env`).

---

## Manual Deploy / Pull

Use `IMAGE_TAG=develop` and `checkout develop` for the dev server; for production use `IMAGE_TAG=main` and `checkout main` (must match the images you built for that branch).

```bash
cd /home/ubuntu/app

export ECR_REGISTRY=717728193407.dkr.ecr.ap-northeast-2.amazonaws.com
export IMAGE_TAG=develop   # or: main

git fetch origin
git checkout develop && git pull origin develop   # prod: main

aws ecr get-login-password --region ap-northeast-2 \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

docker compose -f docker-compose.yml -f docker-compose.ec2.yml pull
docker compose -f docker-compose.yml -f docker-compose.ec2.yml up -d --force-recreate --remove-orphans
```

---

## Backend-Only Redeploy

When only `.env.production.backend` changed:

```bash
cd /home/ubuntu/app
export ECR_REGISTRY=... && export IMAGE_TAG=develop
docker compose -f docker-compose.yml -f docker-compose.ec2.yml up -d --force-recreate backend
```

---

## Bootstrap an Empty Database (First Deploy)

```bash
docker exec tokenable-postgres psql -U tokenable -d tokenable -c '\dt'
```

If empty, apply the bootstrap schema:

```bash
docker exec -i tokenable-postgres psql -U tokenable -d tokenable \
  < /home/ubuntu/app/backend/sql/bootstrap-empty-prod-db.sql
```

Then set `TYPEORM_SYNC=false` in `.env.production.backend` and redeploy the backend.

---

## Verification

```bash
# Container status
docker compose -f docker-compose.yml -f docker-compose.ec2.yml ps

# Logs
docker logs tokenable-backend 2>&1 | tail -80

# API smoke test
curl -s http://localhost:4000/api/auth/session
curl -s http://localhost:4000/api/marketplace/collections
```

### Deploy looks wrong but Actions is green?

- Confirm you are on the intended environment URL (dev vs prod vs Vercel preview if you use additional hosts outside this compose flow).
- Hard refresh / private window rules out stuck JS chunks from a previous deployment.
- `NEXT_PUBLIC_*` is baked into the frontend image at build time — env changes in GitHub require a **new** workflow run after updating secrets/variables.

---

Browser checklist:
- [ ] API calls go to `https://<domain>/api/...` — not a mismatched host/scheme
- [ ] Frontend built without `NEXT_PUBLIC_API_URL` unless using a separate API host
- [ ] `CORS_ORIGIN` lists every frontend origin
- [ ] Google OAuth callback URIs match real URLs

---

## Related Files

| File | Role |
|------|------|
| `.github/workflows/deploy.yml` | CI/CD pipeline |
| `docker-compose.yml` | Base services |
| `docker-compose.ec2.yml` | EC2 overlay (env_file, image tags) |
| `frontend/Dockerfile` | `NEXT_PUBLIC_*` build args |
| `backend/Dockerfile` | Multi-stage NestJS build |
| `nginx/nginx.conf` | HTTP + ACME challenge + `/api` proxy |
| `nginx/nginx.tls.conf` | HTTPS template (not git-tracked, applied post-certbot) |
| `backend/sql/bootstrap-empty-prod-db.sql` | Initial schema for empty production DB |
