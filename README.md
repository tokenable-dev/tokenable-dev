# Tokenable RWA Marketplace

A decentralized marketplace for graded-card RWAs on EVM chains (Sepolia-first). Users mint via IPFS, list, and trade with USDC. Settlement is primarily **OpenSea Seaport 1.5** (signed off-chain orders synced to Postgres). Market data is sourced from the **Cardhedger** proxy on the Nest API; an optional **relational rule-based matching API** exists alongside Seaport (`docs/marketplace-trading.md`). Monorepo: Next.js frontend + Nest backend + Hardhat contracts.

---

## Project Description

Full-stack marketplace for graded-card RWAs on EVM testnets (Sepolia): mint, discover collections, trade with USDC via **Seaport 1.5** off-chain orders. External market references come from the **Cardhedger** API (catalog, mint previews, PSA-10 price history, AI insights) — proxied through the Nest backend.

### What users see today

| Area | Notes |
|------|--------|
| **Landing (`/`)** | Hero + **Market Indexes** (Cardhedger aggregates / sparklines per category). |
| **Exchange (`/exchange`)** | All collections (including zero listings), sorted by pool pricing; category chips; optional grid/list view; **Trending** strip. |
| **Collection detail (`/marketplace/collections/[key]`)** | Unified order book, dual **Tokenable vs Cardhedger** price chart (aligned time axis), criteria bids / listings, **Individual listings** strip (seller, cert #, USDC). |
| **Portfolio (`/portfolio`)** | Holdings with listing vs unlisted distinction and reference vs on-platform pricing. |
| **Vault / mint** | PSA-oriented graded metadata → IPFS; same assets list on the marketplace. |

Trading remains non-custodial until settlement; criteria bids cover Merkle-eligible token sets per collection key.

---

## Tech Stack

### Frontend

- **React 19** / **Next.js 16** (App Router)
- **wagmi** + **viem** — Wallet + contract reads/writes
- **Tailwind CSS** — Styling
- **Zustand** — Lightweight global state (wallet/session)
- **TanStack Query** — Server state, infinite lists, marketplace snapshots

### Backend

- **Node.js** / **TypeScript**
- **NestJS** — REST API, Swagger under `/api/docs`
- **Cardhedger** — Live card/game pricing, mint previews, PSA-10 history, AI insights (`CARDHEDGER_API_KEY` required)
- **PSA Public API** — Cert lookup + slab images (`PSA_PUBLIC_API_TOKEN`)
- **Pinata** — IPFS pinning for RWA metadata/images
- **PostgreSQL + TypeORM** — Orders, collections, optional relational trading layer ([docs/marketplace-trading.md](docs/marketplace-trading.md))

### Smart Contracts

- **Solidity**
- **Hardhat** — Development and deployment
- **OpenZeppelin** — ERC-721, ERC-20, and security patterns

### Blockchain / Web3

- **Ethereum Sepolia** (testnet)
- **MetaMask** — Wallet connection
- **IPFS** — Decentralized storage for RWA metadata and images

---

## Repository Structure

```
tokenable-dev/
├── frontend/     # User interface for interacting with the marketplace
├── backend/      # API server, business logic, and blockchain integration
└── contracts/    # Smart contracts for RWA minting, listing, and trading
```

| Folder       | Description                                                                 |
| ------------ | --------------------------------------------------------------------------- |
| **frontend** | Next.js application for wallet connection, RWA minting, browsing, and trading |
| **backend**  | NestJS API server handling IPFS uploads, blockchain reads, and marketplace data |
| **contracts** | Solidity: TokenableRWA (ERC-721), MockUSDC (ERC-20) — primary trading: Seaport; optional relational match layer in Nest (`docs/marketplace-trading.md`) |

---

## Documentation

| Document | Contents |
|----------|----------|
| **[docs/API-REFERENCE.md](docs/API-REFERENCE.md)** | Full **`/api/*`** route tables (auth, blockchain, psa, marketplace, cardhedger proxy, bids/trade) + App Router pages |
| **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** | Product surfaces, DB, API summary + link to API-REFERENCE, Seaport + relational trading, CI/CD → EC2, PSA troubleshooting, diagram index |
| **[docs/marketplace-trading.md](docs/marketplace-trading.md)** | Rule-based `bids`/`asks`/match API vs Seaport `orders` |
| **[docs/DEPLOY_EC2_DOMAIN.md](docs/DEPLOY_EC2_DOMAIN.md)** | EC2 Docker, domain, same-origin `/api`, CORS, OAuth, TLS checklist |
| **[backend/sql/README.md](backend/sql/README.md)** | Why there are no SQL migrations |

CI/CD: a push to **`develop`** runs GitHub Actions (see `docs/DEVELOPMENT.md` §5 and `.github/workflows/deploy.yml`).

### Architecture & Pipeline Diagrams

| Diagram | Description |
|---------|-------------|
| **[Marketplace Pipeline (KR)](docs/diagrams/marketplace-lifecycle.md)** | 흐름도 · 시퀀스 · DB · 프론트(Part 4) · 백엔드(Part 5) |
| **[Marketplace Pipeline (EN)](docs/diagrams/marketplace-lifecycle.en.md)** | Flow · sequence · DB · frontend (Part 4) · backend (Part 5) |
| **[Seaport Criteria Architecture](docs/diagrams/marketplace-seaport-criteria-architecture.drawio)** | Seaport criteria bid architecture |
| **[Relational trading layer](docs/diagrams/marketplace-trading-relational-layer.drawio)** | Rule engine, DB tables, settlement worker (draw.io) |
| **[Mint → RWA Exchange](docs/diagrams/tokenable-mint-rwa-exchange-full-architecture.drawio)** | Full mint-to-exchange architecture |
| **[PSA Upload & OCR Flow](docs/diagrams/psa-slab-upload-ocr-api-flow.drawio)** | PSA slab upload & OCR API flow |

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- MetaMask (or compatible wallet)

### 1. Clone the repository

```bash
git clone <repository-url>
cd tokenable-dev
```

### 2. Install dependencies

```bash
# Frontend
cd frontend && pnpm install

# Backend
cd ../backend && pnpm install

# Contracts
cd ../contracts && pnpm install
```

### 3. Configure environment variables

Create env files yourself (not committed):

- `backend/.env` — RPC, Postgres, Pinata, JWT/Google, CardHedger, PSA 키 등 (`RWA_CONTRACT_ADDRESS` 필수)
- `frontend/.env` — `NEXT_PUBLIC_*` 만 (로컬용; `NEXT_PUBLIC_RWA_CONTRACT_ADDRESS` · `NEXT_PUBLIC_USDC_CONTRACT_ADDRESS` · `NEXT_PUBLIC_ALCHEMY_RPC_URL` 필수)
- `contracts/.env` — 배포용 `DEPLOYER_PRIVATE_KEY`, `SEPOLIA_RPC_URL`

### 4. Deploy smart contracts

```bash
cd contracts
# Requires contracts/.env: DEPLOYER_PRIVATE_KEY, SEPOLIA_RPC_URL
pnpm run deploy:usdc      # MockUSDC → Sepolia
pnpm run deploy:rwa       # TokenableRWA → Sepolia
```

Update `backend/.env` and `frontend/.env` with the deployed contract addresses.

### 5. Run the application

```bash
# Terminal 1 — Backend (port 4000)
cd backend && pnpm start:dev

# Terminal 2 — Frontend (port 3000)
cd frontend && pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and connect your wallet.

### LAN access (same WiFi)

To access from another device (e.g. phone) on the same network:

1. Find your machine's IP (e.g. `192.168.45.101`) and open `http://<IP>:3000`.
2. **Backend CORS**: Add your IP to `backend/.env`:
   ```
   CORS_ORIGIN=http://localhost:3000,http://192.168.45.101:3000
   ```
3. Restart the backend. The frontend auto-detects the host and calls the API at `<IP>:4000`.

---

## Future ideas

- Marketplace fees, auctions, multi-chain, etc. (track separately from this README.)

---

## License

Proprietary. All rights reserved.
