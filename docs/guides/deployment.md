# Deployment (EC2)

GitHub Actions builds frontend and backend Docker images, pushes them to **AWS ECR**, and SSH-deploys to **EC2** with Docker Compose. This is the default CI/CD path for this monorepo.

### Source branch (what ships)

| Branch | When you push | What runs |
|--------|----------------|-----------|
| **`develop`** | Every push | Build → ECR → **Dev EC2** (`DEV_EC2_*` secrets) |
| **`main`** | Every push | Build → ECR → **Prod EC2** (`PROD_EC2_*` secrets) |

Images are tagged with the branch name (rolling pointer) **and** the full `github.sha` (immutable).

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

**Triggers:** Push to **`develop`** or **`main`**.

1. **build-and-push** (always): build `tokenable-frontend` and `tokenable-backend` → push each image with branch and SHA tags.
2. **deploy-dev** (if branch is `develop`): SSH to dev EC2, `git pull develop`, compose pull/up.
3. **deploy-prod** (if branch is `main`): same for prod host with `IMAGE_TAG=main`.

---

## GitHub Secrets / Variables

`NEXT_PUBLIC_*` values are baked into the frontend bundle at Docker build time — a rebuild is required when they change.

| Name | Required | Description |
|------|----------|-------------|
| `AWS_ACCESS_KEY_ID` | Yes | ECR push credentials |
| `AWS_SECRET_ACCESS_KEY` | Yes | ECR push credentials |
| `ECR_REGISTRY` | Yes | e.g. `717728193407.dkr.ecr.ap-northeast-2.amazonaws.com` |
| `DEV_EC2_HOST` | Yes (`develop`) | Dev EC2 public IP or hostname |
| `DEV_EC2_SSH_KEY` | Yes (`develop`) | Dev SSH private key |
| `PROD_EC2_HOST` | For `main` | Prod EC2 host |
| `PROD_EC2_SSH_KEY` | For `main` | Prod SSH private key |
| `NEXT_PUBLIC_CHAIN_11155111_RPC_URL` | Yes | Sepolia RPC (Alchemy) — Docker build arg |
| `NEXT_PUBLIC_CHAIN_11155111_RWA` | Yes | Sepolia TokenableRWA proxy — Docker build arg |
| `NEXT_PUBLIC_CHAIN_11155111_USDC` | Yes | Sepolia USDC (Circle testnet) — Docker build arg |
| `NEXT_PUBLIC_DEFAULT_CHAIN_ID` | No | Default `11155111` (Sepolia-only) |
| `NEXT_PUBLIC_CHAIN_1_RPC_URL` | No | Ethereum mainnet RPC — add all three when mainnet goes live |
| `NEXT_PUBLIC_CHAIN_1_RWA` | No | Ethereum mainnet TokenableRWA |
| `NEXT_PUBLIC_CHAIN_1_USDC` | No | Ethereum mainnet USDC (`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`) |
| `NEXT_PUBLIC_CHAIN_137_RPC_URL` | No | Polygon mainnet RPC — add all three after Polygon RWA deploy |
| `NEXT_PUBLIC_CHAIN_137_RWA` | No | Polygon TokenableRWA |
| `NEXT_PUBLIC_CHAIN_137_USDC` | No | Polygon native USDC (`0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`) |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Yes | Privy App ID — enables login |
| `NEXT_PUBLIC_PRIVY_FUNDING_ENVIRONMENT` | No | `production` for Polygon live; `sandbox` only for Sepolia QA |
| `NEXT_PUBLIC_PRIVY_FUNDING_USE_ONRAMP_ON_TESTNET` | No | `true` only for Sepolia MoonPay QA |
| `NEXT_PUBLIC_PRIVY_FUNDING_CHAIN_ID` | No | `137` (Polygon) production; `11155111` Sepolia QA. Active mainnet header also wins. |
| `NEXT_PUBLIC_PRIVY_FUNDING_DEFAULT_AMOUNT` | No | Defaults to `50` |
| `NEXT_PUBLIC_PRIVY_FUNDING_SKIP_READINESS_CHECK` | No | Sandbox/testnet only; ignored on mainnet |
| `NEXT_PUBLIC_API_URL` | No | Leave empty for same-origin Nginx proxying |
| `NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT` | No | Fee recipient address |
| `NEXT_PUBLIC_PLATFORM_FEE_BPS` | No | Fee in basis points |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | No | GA4 measurement ID |

`API_PROXY_TARGET` is passed as `--build-arg API_PROXY_TARGET=http://backend:4000` by the workflow automatically.

MoonPay / Add funds: frontend Dockerfile + `deploy.yml` bake `NEXT_PUBLIC_PRIVY_FUNDING_*` at image build. Backend still needs `PRIVY_FUNDING_TARGET_CAIP2` in `.env.production.backend`. See [privy-wallet-funding.md](privy-wallet-funding.md).

---

## EC2 Setup (First Time)

```bash
# On EC2:
git clone https://github.com/<org>/tokenable-dev.git /home/ubuntu/app
```

Create `/home/ubuntu/.env.production.backend` with all backend secrets:

```env
# Privy (required)
PRIVY_APP_ID=<same as NEXT_PUBLIC_PRIVY_APP_ID>
PRIVY_APP_SECRET=<from Privy Dashboard → Settings → App secret>
# PRIVY_JWT_VERIFICATION_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"

FRONTEND_URL=https://your-domain.com
CORS_ORIGIN=https://your-domain.com
COOKIE_SECURE=true
JWT_SECRET=<random 64-char string>

# Database
POSTGRES_HOST=tokenable-postgres
POSTGRES_PORT=5432
POSTGRES_USER=tokenable
POSTGRES_PASSWORD=<secure-password>
POSTGRES_DB=tokenable

# Blockchain — public users stay on Sepolia; internal-dev can switch when chains are configured
DEFAULT_CHAIN_ID=11155111
CHAIN_11155111_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
CHAIN_11155111_RWA_ADDRESS=0x35b2368E718914e981b1C0043c76d4a573163D4A
CHAIN_11155111_USDC_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
# Ethereum mainnet — RPC+USDC ok for reads; RWA required before mint/trade
CHAIN_1_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
# CHAIN_1_RWA_ADDRESS=0x...
CHAIN_1_USDC_ADDRESS=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
# Polygon — required for tokenable.dev@gmail.com internal-dev network switch
CHAIN_137_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
CHAIN_137_RWA_ADDRESS=0x30D41cC4Efa7F1d5cAFE721Eba5743D9B8e5b96E
CHAIN_137_USDC_ADDRESS=0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
RWA_OWNER_PRIVATE_KEY=<backend signer private key>
# Redeem NFT custody — independent of fee wallet (Sepolia v1 may equal PLATFORM_FEE_*)
# RWA_CUSTODY_WALLET_ADDRESS=0x...
# RWA_CUSTODY_PRIVATE_KEY=...       (defaults to RWA_OWNER_PRIVATE_KEY if unset)
# Partner mint+list (encrypts marketplace_partners private keys):
PARTNER_WALLET_ENCRYPTION_KEY=<64 hex chars — openssl rand -hex 32>
PLATFORM_FEE_RECIPIENT=0x...
PLATFORM_FEE_BPS=500
PLATFORM_FEE_PRIVATE_KEY=0x...   # self-vault seller payouts + redeem USDC refunds (same wallet as RECIPIENT)
# SELF_VAULT_AUTO_PAYOUT_CRON=1              # set 0 to disable
# SELF_VAULT_AUTO_PAYOUT_DELAY_SECONDS=300   # fulfill → auto pay (default 5 min)

# Partner FedEx Rates + Track (sandbox Test keys; Production keys later)
# FEDEX_RATE_ENABLED=true
# FEDEX_API_BASE_URL=https://apis-sandbox.fedex.com
# FEDEX_CLIENT_ID=
# FEDEX_CLIENT_SECRET=
# FEDEX_TRACK_CLIENT_ID=
# FEDEX_TRACK_CLIENT_SECRET=
# FEDEX_ACCOUNT_NUMBER=
# FEDEX_RATE_QUOTE_TTL_MINUTES=15
# FEDEX_TRACK_ENABLED=true
# REDEEM_AUTO_RECEIPT_GRACE_DAYS=3
# PARTNER_VAULT_SHIPPING_US_USD=12.99
# PARTNER_VAULT_SHIPPING_CA_USD=28.99
# PARTNER_VAULT_SHIPPING_INTL_USD=39.99

# MoonPay readiness target (Sepolia-first public deploy)
PRIVY_FUNDING_TARGET_CAIP2=eip155:11155111

# IPFS
PINATA_JWT=<pinata jwt>
PINATA_GATEWAY=<gateway>.mypinata.cloud

# Catalog collection covers (S3) — see docs/guides/catalog-cover-s3.md
AWS_REGION=ap-northeast-2
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
CATALOG_COVER_S3_BUCKET=tokenable-catalog-covers
CATALOG_COVER_S3_PREFIX=covers/
CATALOG_COVER_PUBLIC_BASE_URL=https://YOUR_CLOUDFRONT_DOMAIN

# PSA (multi-token pool)
PSA_PUBLIC_API_TOKENS=token1,token2,...

# Cardhedger
CARDHEDGER_API_KEY=<key>

# Admin
MARKETPLACE_ADMIN_USERNAME=<username>
MARKETPLACE_ADMIN_PASSWORD=<password>
MARKETPLACE_ADMIN_SESSION_SECRET=<random>
```

---

## Bootstrap an Empty Database (First Deploy)

```bash
docker exec tokenable-postgres psql -U tokenable -d tokenable -c '\dt'
```

If empty, apply bootstrap (from repo root on EC2 after `git pull`):

```bash
docker exec -i tokenable-postgres env PGPASSWORD=tokenable \
  bash -s < /home/ubuntu/app/backend/sql/scripts/bootstrap-db.sh
```

Then set `TYPEORM_SYNC=false` in `.env.production.backend` and redeploy the backend.

The bootstrap creates **20+ tables** including all vault, auth provider, and KYC tables. See [architecture/database.md](../architecture/database.md) for the full list.

---

## Manual Deploy / Pull

```bash
cd /home/ubuntu/app

export ECR_REGISTRY=717728193407.dkr.ecr.ap-northeast-2.amazonaws.com
export IMAGE_TAG=develop   # or: main

git fetch origin
git checkout develop && git pull origin develop

aws ecr get-login-password --region ap-northeast-2 \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

docker compose -f docker-compose.yml -f docker-compose.ec2.yml pull
docker compose -f docker-compose.yml -f docker-compose.ec2.yml up -d --force-recreate --remove-orphans
```

---

## Verification

```bash
# Container status
docker compose -f docker-compose.yml -f docker-compose.ec2.yml ps

# Logs
docker logs tokenable-backend 2>&1 | tail -80

# API health check
curl -sS https://your-domain.com/api/health
```

---

## Deploy Checklist

- [ ] API calls go to `https://<domain>/api/...`
- [ ] Frontend built with correct `NEXT_PUBLIC_*` env
- [ ] `CORS_ORIGIN` lists every frontend origin
- [ ] `FRONTEND_URL` matches the public HTTPS URL (required for Privy cookies)
- [ ] GitHub secret `NEXT_PUBLIC_PRIVY_APP_ID` set and frontend image rebuilt
- [ ] EC2 `.env.production.backend` has `PRIVY_APP_ID` + `PRIVY_APP_SECRET`
- [ ] Privy Dashboard → **Domains** includes `https://your-domain.com`
- [ ] `RWA_OWNER_PRIVATE_KEY` configured with MINTER_ROLE + BURNER_ROLE on deployed contract
- [ ] If custody wallet differs from minter: `RWA_CUSTODY_WALLET_ADDRESS` + `RWA_CUSTODY_PRIVATE_KEY`
- [ ] `PLATFORM_FEE_PRIVATE_KEY` set (self-vault payouts + redeem USDC refunds)
- [ ] `PARTNER_WALLET_ENCRYPTION_KEY` set before using Partners / bulk mint+list
- [ ] **Schema:** after pulling new code, apply any pending `backend/sql/maintenance/*.sql` **before** restarting backend. Production boot runs `SchemaAssertService` and **exits** if required columns/tables are missing (e.g. `rwa_tokens.vault_partner_id`). Escape hatch: `SCHEMA_ASSERT_ON_BOOT=0`.
- [ ] `PSA_PUBLIC_API_TOKENS` configured (comma-separated pool)
- [ ] Ethereum mainnet: add `CHAIN_1_*` env vars when ready
- [ ] Polygon mainnet: add `CHAIN_137_*` / `NEXT_PUBLIC_CHAIN_137_*` after deploy

---

## Troubleshooting

### Backend exits on boot: “Database schema is behind”

Production asserts required tables/columns (see `backend/src/health/schema-assert.service.ts`). Apply the listed `backend/sql/maintenance/…` files, then restart. Temporary bypass: `SCHEMA_ASSERT_ON_BOOT=0` (do not leave on).

### `/api/...` returns 502 Bad Gateway

1. **Nginx → Nest**: `docker logs tokenable-backend --tail=100`. If it never reaches "Server running", check `POSTGRES_*` / `.env.production.backend`.
2. **Next.js image**: Images built **without** `API_PROXY_TARGET=http://backend:4000` bake `http://127.0.0.1:4000`. Redeploy with the workflow build-arg.
3. **Sanity check**: `curl -sS https://<your-domain>/api/health`

### Privy login fails

- Verify Privy Dashboard → Domains includes production URL
- Verify `PRIVY_APP_ID` in both GitHub secret (frontend image) and `.env.production.backend`
- Check `FRONTEND_URL` and `CORS_ORIGIN` are set correctly

### Vault mint fails

- Verify `RWA_OWNER_PRIVATE_KEY` has MINTER_ROLE: `pnpm grant-burner:sepolia` (or check on-chain)
- Verify `CHAIN_11155111_RWA_ADDRESS` matches deployed contract
- Run `pnpm sync-abi` after any contract upgrade and redeploy backend

---

## Related Files

| File | Role |
|------|------|
| `.github/workflows/deploy.yml` | CI/CD pipeline |
| `docker-compose.yml` | Base services |
| `docker-compose.ec2.yml` | EC2 overlay (env_file, image tags) |
| `frontend/Dockerfile` | `NEXT_PUBLIC_*` build args |
| `backend/Dockerfile` | Multi-stage NestJS build; fails if `dist/main.js` missing |
| `backend/tsconfig.build.json` | Compile `src/` only so entrypoint is `dist/main.js` |
| `backend/sql/bootstrap-empty-prod-db.sql` | Initial schema |
| `contracts/scripts/deploy-tokenable-rwa-uups.ts` | Contract deployment |
| `contracts/scripts/sync-abi.mjs` | ABI sync after contract change |
