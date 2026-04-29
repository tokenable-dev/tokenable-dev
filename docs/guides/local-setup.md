# Local Setup

## Prerequisites

- **Node.js** ≥ 22
- **pnpm** ≥ 9
- **Docker** + Docker Compose (for PostgreSQL)
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
```

---

## 2. Start PostgreSQL

```bash
docker compose up -d postgres
```

Tables are auto-created at backend startup via TypeORM `synchronize: true` (dev mode).

---

## 3. Backend Environment

Create `backend/.env`:

```env
# Server
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=tokenable
POSTGRES_PASSWORD=tokenable
POSTGRES_DB=tokenable

# Auth
JWT_SECRET=your_jwt_secret_here
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
FRONTEND_URL=http://localhost:3000

# Blockchain (Sepolia)
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
RWA_CONTRACT_ADDRESS=0x...
USDC_CONTRACT_ADDRESS=0x...

# IPFS
PINATA_JWT=your_pinata_jwt
PINATA_GATEWAY=your_gateway.mypinata.cloud

# External APIs
CARDHEDGER_API_KEY=your_cardhedger_key
PSA_PUBLIC_API_TOKEN=your_psa_token    # optional

# Email (optional)
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USER=user@example.com
MAIL_PASS=your_password
MAIL_FROM="Tokenable <noreply@example.com>"
```

---

## 4. Frontend Environment

Create `frontend/.env`:

```env
# These are NEXT_PUBLIC — baked into the JS bundle at build time (not at runtime)
NEXT_PUBLIC_RWA_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_USDC_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_ALCHEMY_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY

# Optional
NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT=0x...
NEXT_PUBLIC_PLATFORM_FEE_BPS=250

# Leave unset in local dev — browser will use window.location.origin + "/api"
# NEXT_PUBLIC_API_URL=
```

> **Note:** `NEXT_PUBLIC_*` variables are embedded at **build time**, not runtime. Changing them requires a rebuild.

---

## 5. Start Services

```bash
# Backend (port 4000)
cd backend && pnpm start:dev

# Frontend (port 3000)
cd frontend && pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).  
Swagger: [http://localhost:4000/api/docs](http://localhost:4000/api/docs).

---

## 6. Reset the Database

```bash
docker compose down
docker volume ls        # find the volume name (e.g. tokenable-dev_postgres_data)
docker volume rm tokenable-dev_postgres_data
docker compose up -d postgres
# restart backend — TypeORM will recreate tables
```

---

## 7. Smart Contracts (optional)

Contracts are pre-deployed on Sepolia. To redeploy:

```bash
cd contracts
pnpm install
# edit hardhat.config.ts with your private key and RPC URL
pnpm deploy:rwa          # deploy TokenableRWA
```

Update `RWA_CONTRACT_ADDRESS` in `backend/.env` and `NEXT_PUBLIC_RWA_CONTRACT_ADDRESS` in `frontend/.env`.

---

## Useful Commands

```bash
# Backend type-check
cd backend && npx tsc --noEmit

# Frontend type-check
cd frontend && npx tsc --noEmit

# Format + lint (backend)
cd backend && pnpm format && pnpm lint

# Format + lint (frontend)
cd frontend && pnpm lint
```
