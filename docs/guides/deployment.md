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

## GitHub Secrets (deploy only)

Keep **only** infrastructure secrets in GitHub Actions. Frontend `NEXT_PUBLIC_*` live on the **EC2 host** (same idea as backend env):

| On EC2 | Purpose |
|--------|---------|
| `/home/ubuntu/.env.production.backend` | Runtime secrets (Alchemy, DB, Privy secret, …) |
| `/home/ubuntu/.env.production.frontend` | Frontend bake (`NEXT_PUBLIC_*`) — CI copies this via SSH before `docker build` |

Details: [`deploy/README.md`](../../deploy/README.md).

| Secret | Required | Purpose |
|--------|----------|---------|
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Yes | ECR push |
| `ECR_REGISTRY` | Yes | Registry host |
| `DEV_EC2_HOST` / `DEV_EC2_SSH_KEY` | Yes (`develop`) | Dev SSH (deploy + fetch frontend env) |
| `PROD_EC2_HOST` / `PROD_EC2_SSH_KEY` | For `main` | Prod SSH |

**Do not** put `NEXT_PUBLIC_*` in GitHub Secrets or commit real `deploy/*.env` files. Use a **public** Sepolia RPC in the frontend host file; Alchemy only in `.env.production.backend`.

After editing `.env.production.frontend` on EC2, push (or re-run Actions) so the frontend image rebuilds.

MoonPay / Add funds: `NEXT_PUBLIC_PRIVY_FUNDING_*` go in `.env.production.frontend`. Backend still needs `PRIVY_FUNDING_TARGET_CAIP2` in `.env.production.backend`. See [privy-wallet-funding.md](privy-wallet-funding.md).

---

## Backend env on EC2

Create `/home/ubuntu/.env.production.backend` with all backend secrets.

**Pokémon Cardhedger shadow (staging only):** on **Dev EC2** you may set `CARDHEDGER_POKEMON_NORMALIZED_SHADOW=1` for observation-only normalized matching telemetry. Leave it unset or `0` on **Prod EC2** (`main`). Never enable it as a production cutover switch — legacy resolve remains the returned identity until a separate human-reviewed cutover.

```env
# Privy (required)
PRIVY_APP_ID=<same as NEXT_PUBLIC_PRIVY_APP_ID in /home/ubuntu/.env.production.frontend>
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
CHAIN_11155111_RWA_ADDRESS=0xF7242F62153ac2F42CbF331724F38B93829381c3
CHAIN_11155111_USDC_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
# Ethereum mainnet — RPC+USDC ok for reads; RWA required before mint/trade
CHAIN_1_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
CHAIN_1_RWA_ADDRESS=0xa8a7568E0A5f0dC2F5143ad09D12a032b3c145ad
CHAIN_1_USDC_ADDRESS=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
# Polygon — required for tokenable.dev@gmail.com internal-dev network switch
CHAIN_137_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
CHAIN_137_RWA_ADDRESS=0x4d1FA7a19C5b6a5fd4aB0E9521eb5Ef252993d35
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
# FEDEX_TRACK_SANDBOX_ONES_DELIVERED=true
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

Do **not** use `git pull` on EC2 if `nginx/nginx.tls.conf` was edited on the server or `nginx.tls.conf.bak.*` files exist — pull can refuse or leave a dirty tree. Use the same sync as GitHub Actions:

```bash
cd /home/ubuntu/app

export ECR_REGISTRY=717728193407.dkr.ecr.ap-northeast-2.amazonaws.com
export IMAGE_TAG=develop   # or: main

git fetch origin
git checkout develop   # or: main
bash deploy/ec2-sync-git.sh develop   # or: main

aws ecr get-login-password --region ap-northeast-2 \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

docker compose -f docker-compose.yml -f docker-compose.ec2.yml pull
docker compose -f docker-compose.yml -f docker-compose.ec2.yml up -d postgres redis
bash backend/sql/scripts/apply-deploy-maintenance.sh
docker compose -f docker-compose.yml -f docker-compose.ec2.yml up -d --force-recreate --no-deps backend frontend nginx
docker compose -f docker-compose.yml -f docker-compose.ec2.yml up -d --remove-orphans
```

CI uses the same order. Avoid `up -d --force-recreate` on **postgres** every deploy — it restarts the DB while maintenance SQL runs and can fail with `the database system is shutting down` on t3.medium hosts.

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
- [ ] `/home/ubuntu/.env.production.frontend` exists on EC2 and frontend image rebuilt
- [ ] EC2 `.env.production.backend` has `PRIVY_APP_ID` + `PRIVY_APP_SECRET`
- [ ] Privy Dashboard → **Domains** includes `https://your-domain.com`
- [ ] `RWA_OWNER_PRIVATE_KEY` configured with MINTER_ROLE + BURNER_ROLE on deployed contract
- [ ] If custody wallet differs from minter: `RWA_CUSTODY_WALLET_ADDRESS` + `RWA_CUSTODY_PRIVATE_KEY`
- [ ] `PLATFORM_FEE_PRIVATE_KEY` set (self-vault payouts + redeem USDC refunds)
- [ ] `PARTNER_WALLET_ENCRYPTION_KEY` set before using Partners / bulk mint+list
- [ ] **Schema:** after pulling new code, apply any pending `backend/sql/maintenance/*.sql` **before** restarting backend (CI runs `backend/sql/scripts/apply-deploy-maintenance.sh` on deploy). Production boot runs `SchemaAssertService` and **exits** if required columns/tables are missing (e.g. `vault_submission_items.card_number`). Escape hatch: `SCHEMA_ASSERT_ON_BOOT=0`.
- [ ] `PSA_PUBLIC_API_TOKENS` configured (comma-separated pool)
- [ ] Ethereum mainnet: add `CHAIN_1_*` env vars when ready
- [ ] Polygon mainnet: add `CHAIN_137_*` / `NEXT_PUBLIC_CHAIN_137_*` after deploy

---

## Troubleshooting

### Backend exits on boot: “Database schema is behind”

Production asserts required tables/columns (see `backend/src/health/schema-assert.service.ts`). Apply the listed `backend/sql/maintenance/…` files, then restart. Temporary bypass: `SCHEMA_ASSERT_ON_BOOT=0` (do not leave on).

**`column c.token_contract does not exist` (500 on collection lists):** the API was deployed before `add_marketplace_collections_token_contract.sql` ran. This is a missing additive column, not a dropped table. Apply that file (see below), then retry. Do not re-run bootstrap or a marketplace reset.

**`vault_submission_items.card_number does not exist` (500 on `/api/vault/submissions`):** code was deployed before `add_vault_submission_item_display_fields.sql` ran on the server DB. Fix immediately:

```bash
cd /home/ubuntu/app
bash backend/sql/scripts/apply-deploy-maintenance.sh
docker-compose -f docker-compose.yml -f docker-compose.ec2.yml up -d --force-recreate backend
```

Or one file only:

```bash
docker exec -i tokenable-postgres psql -U tokenable -d tokenable -v ON_ERROR_STOP=1 \
  < backend/sql/maintenance/add_vault_submission_item_display_fields.sql
```

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
