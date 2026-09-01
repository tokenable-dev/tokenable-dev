# Local Setup

## Prerequisites

- **Node.js** ≥ 22
- **pnpm** ≥ 9
- **Docker** + Docker Compose (for PostgreSQL and Redis)
- Git

---

## 1. Clone & Install

```bash
git clone https://github.com/<org>/tokenable-dev.git
cd tokenable-dev

# Backend
cd backend && pnpm install && cd ..

# Frontend
cd frontend && pnpm install && cd ..

# Contracts (optional)
cd contracts && pnpm install && cd ..
```

---

## 2. Start PostgreSQL & Redis

```bash
docker compose up -d postgres redis
```

Tables are auto-created at backend startup via TypeORM `synchronize: true` (dev mode).  
Alternatively, apply canonical DDL: see [backend/sql/README.md](../../backend/sql/README.md).

---

## 3. Backend Environment

Create `backend/.env`:

```env
# Server
PORT=4100
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=tokenable
POSTGRES_PASSWORD=tokenable
POSTGRES_DB=tokenable

# Redis (identity cache L2 — requires `docker compose up -d redis`)
# Host port 6380 avoids conflict with any Cursor/VS Code Redis on 6379
REDIS_URL=redis://127.0.0.1:6380
# IDENTITY_SERVICE_ENABLED=true  # L1/L2 cache + hydrate; DB identity writes always run

# Auth
JWT_SECRET=your_jwt_secret_here
FRONTEND_URL=http://localhost:3000

# Privy (required for login)
PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret
# Optional: PEM public key from Privy Dashboard (avoids JWKS fetch)
# PRIVY_JWT_VERIFICATION_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"

# Blockchain (Ethereum Sepolia — default dev chain)
DEFAULT_CHAIN_ID=11155111
CHAIN_11155111_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
CHAIN_11155111_RWA_ADDRESS=0x...
CHAIN_11155111_USDC_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238

# Ethereum mainnet (optional — enable when ready for prod)
# CHAIN_1_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
# CHAIN_1_RWA_ADDRESS=0x...
# CHAIN_1_USDC_ADDRESS=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48

# Polygon mainnet (optional — cheaper mainnet testing via NetworkSwitcher)
# CHAIN_137_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
# CHAIN_137_RWA_ADDRESS=0x...
# CHAIN_137_USDC_ADDRESS=0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359


# Platform signing keys (required for vault mint/burn)
RWA_OWNER_PRIVATE_KEY=0x...   # MINTER_ROLE + BURNER_ROLE
# Redeem NFT custody (independent of fee wallet; Sepolia v1 may equal PLATFORM_FEE_*)
# RWA_CUSTODY_WALLET_ADDRESS=0x...  (defaults to address of RWA_CUSTODY_PRIVATE_KEY / owner)
# RWA_CUSTODY_PRIVATE_KEY=0x...     (optional; defaults to RWA_OWNER_PRIVATE_KEY)
# Partner consignment mint+list — AES-256-GCM master key (openssl rand -hex 32):
PARTNER_WALLET_ENCRYPTION_KEY=
PLATFORM_FEE_RECIPIENT=0x...
PLATFORM_FEE_BPS=500
# Fee-wallet USDC outflows: self_vault seller payouts + redeem refunds (must derive PLATFORM_FEE_RECIPIENT)
PLATFORM_FEE_PRIVATE_KEY=
# Self-vault auto confirm+payout (~5 min after fulfill). Set CRON=0 to disable.
SELF_VAULT_AUTO_PAYOUT_CRON=1
SELF_VAULT_AUTO_PAYOUT_DELAY_SECONDS=300

# Partner Self vault shipping (FedEx Rates). Stub USD when FEDEX_RATE_ENABLED=false.
# FEDEX_RATE_ENABLED=false
# FEDEX_API_BASE_URL=https://apis-sandbox.fedex.com
# FEDEX_CLIENT_ID=
# FEDEX_CLIENT_SECRET=
# FEDEX_TRACK_CLIENT_ID=
# FEDEX_TRACK_CLIENT_SECRET=
# FEDEX_ACCOUNT_NUMBER=
# FEDEX_RATE_QUOTE_TTL_MINUTES=15
# Redeem delivery → auto receipt (FedEx Track; separate BIV project keys)
# FEDEX_TRACK_ENABLED=false
# Address autocomplete (Redeem / Settings / Partner origin). Server-side Places.
# Omit in production to hide the search line. Local mock works without a key.
# GOOGLE_PLACES_API_KEY=
# FEDEX_TRACK_SANDBOX_ONES_DELIVERED=true
# REDEEM_FEDEX_TRACK_CRON=*/30 * * * *
# REDEEM_AUTO_RECEIPT_ENABLED=true
# REDEEM_AUTO_RECEIPT_GRACE_SECONDS=300
# REDEEM_AUTO_RECEIPT_GRACE_DAYS=3
# PARTNER_VAULT_SHIPPING_US_USD=12.99
# PARTNER_VAULT_SHIPPING_CA_USD=28.99
# PARTNER_VAULT_SHIPPING_INTL_USD=39.99
# Soft stub for some unsupported packaging lanes; KR→KR hard-fails (no stub).

# P2P payment escrow (after `cd contracts && pnpm deploy:escrow:sepolia`)
# CHAIN_11155111_PAYMENT_ESCROW_ADDRESS=0x...
# PAYMENT_ESCROW_ARBITER_PRIVATE_KEY=   # defaults to RWA_OWNER_PRIVATE_KEY
P2P_NO_SHIP_CRON=1
P2P_AUTO_RELEASE_CRON=1

# IPFS
PINATA_JWT=your_pinata_jwt
PINATA_GATEWAY=your_gateway.mypinata.cloud

# Catalog collection covers (optional — Admin Collections S3 upload)
# See docs/guides/catalog-cover-s3.md
# AWS_REGION=ap-northeast-2
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# CATALOG_COVER_S3_BUCKET=tokenable-catalog-covers
# CATALOG_COVER_S3_PREFIX=dev/covers/
# CATALOG_COVER_PUBLIC_BASE_URL=https://YOUR_CLOUDFRONT_OR_S3_BASE

# PSA — multi-token pool (comma-separated; each ~1 req/day free tier)
PSA_PUBLIC_API_TOKENS=token1,token2
# PSA_PUBLIC_API_UPSTREAM_ENABLED=true
# PSA_PUBLIC_API_REFRESH_ON_SNAPSHOT=always

# Cardhedger
CARDHEDGER_API_KEY=your_cardhedger_key

# Admin console
MARKETPLACE_ADMIN_USERNAME=skyand
MARKETPLACE_ADMIN_PASSWORD=071725
MARKETPLACE_ADMIN_SESSION_SECRET=dev_secret_change_in_prod

# Collection market snapshot worker (optional — code defaults apply)
# MARKET_SNAPSHOT_ON_DEMAND=true
# MARKET_SNAPSHOT_STALE_AFTER_SEC=900

# Portfolio daily snapshots — 09:00 KST cron
PORTFOLIO_SNAPSHOT_CRON_ENABLED=true
PORTFOLIO_SNAPSHOT_BOOTSTRAP_ENABLED=true

# Performance instrumentation
# PERF_LOG=true
# PERF_THRESHOLD_MS=200
# PERF_THRESHOLD_DB_MS=500

# Site access gate (staging only)
# SITE_ACCESS_ENABLED=true
# SITE_ACCESS_PASSWORD=dev_password
# SITE_ACCESS_SECRET=dev_secret
```

---

## 4. Frontend Environment

Create `frontend/.env`:

```env
# Privy auth
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
# Default: MetaMask + Google + email on the primary login row (Coinbase/WalletConnect under "More options").
# Wallet-first users get their MetaMask as primary signing wallet.
# Email/social users get their Privy embedded wallet as primary signing wallet.
# Dashboard requirements: External wallets → ON (Ethereum), "Allow new users to sign up with external wallets" ON.
# Overrides:
# NEXT_PUBLIC_PRIVY_LOGIN_MINIMAL=true      → email OTP only (no wallet, no Google)
# NEXT_PUBLIC_PRIVY_FULL_LOGIN=true         → all Privy login methods (dev / lab)

# Chain configuration (Ethereum Sepolia default)
NEXT_PUBLIC_DEFAULT_CHAIN_ID=11155111
NEXT_PUBLIC_CHAIN_11155111_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_CHAIN_11155111_RWA=0x...
NEXT_PUBLIC_CHAIN_11155111_USDC=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238

# Ethereum mainnet (optional)
# NEXT_PUBLIC_CHAIN_1_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
# NEXT_PUBLIC_CHAIN_1_RWA=0x...
# NEXT_PUBLIC_CHAIN_1_USDC=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48

# Polygon mainnet (optional — internal NetworkSwitcher)
# NEXT_PUBLIC_CHAIN_137_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
# NEXT_PUBLIC_CHAIN_137_RWA=0x...
# NEXT_PUBLIC_CHAIN_137_USDC=0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359


# MoonPay / Add funds (Sepolia sandbox — see guides/privy-wallet-funding.md)
# NEXT_PUBLIC_PRIVY_FUNDING_ENVIRONMENT=sandbox
# NEXT_PUBLIC_PRIVY_FUNDING_USE_ONRAMP_ON_TESTNET=true
# NEXT_PUBLIC_PRIVY_FUNDING_CHAIN_ID=11155111

# Platform fee
NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT=0x...
NEXT_PUBLIC_PLATFORM_FEE_BPS=500

# Optional
# NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
# NEXT_PUBLIC_API_URL=   (leave unset — uses window.location.origin + "/api")
# Catalog mock covers from S3 (same public base as backend CATALOG_COVER_PUBLIC_BASE_URL)
# NEXT_PUBLIC_CATALOG_COVER_PUBLIC_BASE_URL=https://YOUR_CLOUDFRONT_OR_S3_BASE
```

> **Note:** `NEXT_PUBLIC_*` variables are embedded at **build time**, not runtime. Changing them requires a `pnpm dev` restart (dev) or rebuild (production).

---

## 5. Start Services

```bash
# Backend (port 4100 in dev)
cd backend && pnpm start:dev

# Frontend (port 3000)
cd frontend && pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).  
Swagger: [http://localhost:4100/api/docs](http://localhost:4100/api/docs).

**Admin console:** [http://localhost:3000/marketplace/admin](http://localhost:3000/marketplace/admin) — default dev login `skyand` / `071725`.

---

## 6. Reset the Database

```bash
docker compose down
docker volume rm tokenable-dev_postgres_data
docker compose up -d postgres

# Option A: restart backend — TypeORM synchronize recreates tables (dev)
# Option B: production-style bootstrap
chmod +x backend/sql/scripts/bootstrap-db.sh
docker exec -i tokenable-postgres env PGPASSWORD=tokenable \
  bash -s < backend/sql/scripts/bootstrap-db.sh
```

After a reset, hard-refresh the browser or clear `localStorage` keys `tokenable.rq.*`.

---

## 7. Smart Contracts (optional)

Contracts may already be deployed on Sepolia. To redeploy:

```bash
cd contracts
pnpm install
# edit contracts/.env with DEPLOYER_PRIVATE_KEY and Sepolia RPC
pnpm deploy:rwa:sepolia    # deploy TokenableRWA to Sepolia (11155111)
# pnpm deploy:rwa:polygon   # Polygon (137) — set POLYGON_RPC_URL
pnpm sync-abi              # copy updated ABI to backend
```

After deploying, update `CHAIN_11155111_RWA_ADDRESS` in `backend/.env` and `NEXT_PUBLIC_CHAIN_11155111_RWA` in `frontend/.env`. For Polygon, set `CHAIN_137_*` / `NEXT_PUBLIC_CHAIN_137_*` the same way.

Grant roles to your backend hot wallet:

```bash
pnpm grant-burner:sepolia  # grants BURNER_ROLE to RWA_OWNER_PRIVATE_KEY address
```

---

## Useful Commands

```bash
# Type check
cd backend && pnpm exec tsc --noEmit
cd frontend && pnpm exec tsc --noEmit

# Lint + format (backend)
cd backend && pnpm format && pnpm lint

# Lint (frontend)
cd frontend && pnpm lint

# Backend tests
cd backend && pnpm test:ci

# Contract tests
cd contracts && pnpm test

# Contract compile + ABI sync
cd contracts && pnpm compile && pnpm sync-abi
```

---

## Vault Mint Policy

Only **PSA 10** graded cards can mint. `POST /api/rwa/upload` returns `400` if graded metadata is not PSA with grade 10. Complete Vault cert lookup / slab analyze first.

The mint flow:
1. Upload IPFS metadata → `POST /api/rwa/upload`
2. Mint to custody → `POST /api/rwa/mint` (backend signs tx; NFT goes to custody wallet)
3. Admin delivers NFT → `POST /api/marketplace/admin/rwa-tokens/:id/deliver`

See [docs/architecture/vault-lifecycle.md](../architecture/vault-lifecycle.md) for the full flow.
