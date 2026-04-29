# Deployment (EC2)

GitHub Actions builds Docker images, pushes to AWS ECR, and deploys to EC2 on every push to `develop`.

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

**Trigger:** Push to `develop` branch  
**File:** `.github/workflows/deploy.yml`

Steps:
1. Build `tokenable-backend` Docker image → push to ECR with `develop` + commit SHA tags
2. Build `tokenable-frontend` Docker image (bakes `NEXT_PUBLIC_*` build args) → push to ECR
3. SSH to EC2 → `docker compose pull && up --force-recreate`

---

## GitHub Secrets / Variables

All of the following must be set in **Repository Secrets** (recommended) or Variables.  
`NEXT_PUBLIC_*` values are baked into the frontend bundle at Docker build time — a rebuild is required when they change.

| Name | Required | Description |
|------|----------|-------------|
| `AWS_ACCESS_KEY_ID` | Yes | ECR push credentials |
| `AWS_SECRET_ACCESS_KEY` | Yes | ECR push credentials |
| `ECR_REGISTRY` | Yes | e.g. `717728193407.dkr.ecr.ap-northeast-2.amazonaws.com` |
| `DEV_EC2_HOST` | Yes | EC2 public IP or domain |
| `DEV_EC2_SSH_KEY` | Yes | SSH private key |
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

```bash
cd /home/ubuntu/app

export ECR_REGISTRY=717728193407.dkr.ecr.ap-northeast-2.amazonaws.com
export IMAGE_TAG=develop

git fetch origin
git checkout develop && git pull origin develop

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
