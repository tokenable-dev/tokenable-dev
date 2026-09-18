# Tokenable RWA Marketplace

A decentralized marketplace for graded-card RWAs on **Ethereum Sepolia** (11155111, default/dev) and **Ethereum mainnet** (1, production), with **Polygon mainnet** (137) for internal/QA. Users mint **PSA 10** cards via IPFS, list, and trade with USDC. Settlement is **OpenSea Seaport 1.5** (signed off-chain orders in Postgres). External pricing is **materialized** from Cardhedger into `collection_market_snapshots` ([docs/architecture/database.md](docs/architecture/database.md)). Monorepo: Next.js frontend + Nest backend + Hardhat contracts. Smart-contract inventory: **[docs/architecture/blockchain.md](docs/architecture/blockchain.md)**.

---

## Project Description

Full-stack marketplace for graded-card RWAs: mint, discover collections, trade with USDC via **Seaport 1.5** off-chain orders. External market references come from the **Cardhedger** API (catalog, mint previews, PSA-10 price history, AI insights) — proxied through the Nest backend. Landing **Market Indexes** use **Card Ladder** scrape + cache.

### What users see today

| Area | Notes |
|------|--------|
| **Landing (`/`)** | Hero + **Market Indexes** (Card Ladder aggregates / sparklines per category). |
| **Markets (`/markets`)** | All collections (including zero listings), sorted by pool pricing; category chips; grid/list view; **Trending** strip. Legacy `/exchange` redirects here. |
| **Collection detail (`/marketplace/collections/[key]`)** | Order book, dual price chart, listing strip, Cardhedger AI insight, schema/identifiers. |
| **Portfolio (`/portfolio`)** | Holdings with listing vs unlisted distinction, daily value chart, hide holdings, reference vs on-platform pricing. |
| **Watchlist (`/watchlist`)** | Saved collections (JWT). |
| **Vault / mint (`/vault`)** | PSA-oriented graded metadata → IPFS → on-chain mint (Vault inbound workflow is planned separately). |
| **Marketplace admin (`/marketplace/admin/*`)** | Separate admin login — collections, cards, markets preview, price webhooks. |
| **Site access (`/site-access`)** | Optional staging gate when `SITE_ACCESS_ENABLED=true`. |

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

- **Node.js 22+** / **TypeScript**
- **NestJS 11** — REST API, Swagger under `/api/docs`
- **Cardhedger** — Live card/game pricing, mint previews, `/api/cardhedger/v1/*` proxy (`CARDHEDGER_API_KEY` required)
- **PSA Public API** — Cert lookup + slab OCR (`PSA_PUBLIC_API_TOKEN`)
- **Pinata** — IPFS pinning for RWA metadata/images
- **PostgreSQL + TypeORM** — 17 entities / ~17 tables ([docs/architecture/database.md](docs/architecture/database.md))
- **Redis** (optional) — Collection identity cache L2

### Smart Contracts

- **Solidity 0.8.20** / **Hardhat** — TokenableRWA (UUPS ERC-721)
- **OpenZeppelin 4.9.6** upgradeable — AccessControl, Pausable, ERC-2981
- **Seaport 1.5** + **Circle USDC** — external protocols (we integrate, do not fork)

Details, ownership, and deployed proxy addresses: **[docs/architecture/blockchain.md](docs/architecture/blockchain.md)**.

### Blockchain / Web3

- **Ethereum Sepolia** (11155111) — default local / public test
- **Ethereum mainnet** (1) — production
- **Polygon mainnet** (137) — internal / QA multi-chain
- **Privy** + **MetaMask** — wallet connection / embedded wallets
- **IPFS (Pinata)** — RWA metadata and images

---

## Repository Structure

```
tokenable-dev/
├── frontend/       # Next.js App Router (port 3000)
├── backend/        # NestJS API (port 4000 prod / 4100 local dev)
├── contracts/      # Hardhat — TokenableRWA (UUPS ERC-721); USDC is external (Circle)
├── docs/           # Architecture, API reference, guides, diagrams
├── docker/         # Postgres init scripts
├── nginx/          # Reverse proxy configs (HTTP + TLS)
├── certbot/        # ACME webroot for Let's Encrypt
├── docker-compose.yml
├── docker-compose.local.yml
└── docker-compose.ec2.yml
```

| Folder | Description |
|--------|-------------|
| **frontend** | Wallet connection, RWA minting, markets, portfolio, watchlist, marketplace admin UI |
| **backend** | IPFS uploads, blockchain reads, Seaport order book, Cardhedger/PSA/Card Ladder integration |
| **contracts** | TokenableRWA — mint/burn; trading via Seaport ([docs/architecture/blockchain.md](docs/architecture/blockchain.md), [docs/api/marketplace.md](docs/api/marketplace.md)) |
| **docs** | Canonical documentation index — start at [docs/README.md](docs/README.md) |

---

## Documentation

| Document | Contents |
|----------|----------|
| **[docs/README.md](docs/README.md)** | Documentation index · branches/deploy · quick links |
| **[docs/api/README.md](docs/api/README.md)** | **`/api/*`** overview · links to scoped API docs |
| **[docs/architecture/overview.md](docs/architecture/overview.md)** | High-level system layout |
| **[docs/architecture/blockchain.md](docs/architecture/blockchain.md)** | Smart contracts inventory · TokenableRWA · Seaport · USDC · deployments |
| **[docs/architecture/database.md](docs/architecture/database.md)** | PostgreSQL schema (17 tables) |
| **[docs/frontend/routes.md](docs/frontend/routes.md)** | App Router route reference |
| **[frontend/README.md](frontend/README.md)** | Frontend runbook · architecture · design-system docs |
| **[docs/guides/local-setup.md](docs/guides/local-setup.md)** | Local dev setup |
| **[docs/guides/deployment.md](docs/guides/deployment.md)** | GitHub Actions · ECR · EC2 · secrets |
| **[docs/guides/networking.md](docs/guides/networking.md)** | Nginx · same-origin `/api` · CORS · OAuth · TLS checklist |
| **[backend/sql/README.md](backend/sql/README.md)** | Production bootstrap DDL |

CI/CD: every push to **`develop`** (or **`main`** for prod, when configured) runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) — see **[docs/guides/deployment.md](docs/guides/deployment.md)**.

### Pipeline diagrams (Mermaid)

| Diagram | Description |
|---------|-------------|
| **[Marketplace Pipeline (KR)](docs/diagrams/marketplace-lifecycle.md)** | 흐름도 · 시퀀스 · DB · 프론트(Part 4) · 백엔드(Part 5) |
| **[Marketplace Pipeline (EN)](docs/diagrams/marketplace-lifecycle.en.md)** | Flow · sequence · DB · frontend (Part 4) · backend (Part 5) |

---

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 9+
- Docker + Docker Compose (PostgreSQL + Redis)
- MetaMask (or compatible wallet)

### 1. Clone the repository

```bash
git clone <repository-url>
cd tokenable-dev
```

### 2. Install dependencies

```bash
cd backend && pnpm install && cd ..
cd frontend && pnpm install && cd ..
cd contracts && pnpm install && cd ..
```

### 3. Configure environment variables

Create env files yourself (not committed):

- `backend/.env` — RPC, Postgres, Redis, Pinata, JWT/Privy, Cardhedger, PSA keys (`CHAIN_11155111_*` / `CHAIN_1_*` / `CHAIN_137_*` per chain)
- `frontend/.env` — `NEXT_PUBLIC_*` only (`NEXT_PUBLIC_CHAIN_{id}_RPC_URL`, `_RWA`, `_USDC`; default chain `11155111`)
- `contracts/.env` — deploy `DEPLOYER_PRIVATE_KEY`, Sepolia / Polygon / mainnet RPC URLs

See **[docs/guides/local-setup.md](docs/guides/local-setup.md)** for a full template.

### 4. Start infrastructure

```bash
docker compose up -d postgres redis
```

### 5. Deploy smart contracts (optional)

Contracts may already be deployed. To redeploy:

```bash
cd contracts
pnpm run deploy:rwa:sepolia   # TokenableRWA → Ethereum Sepolia (11155111)
pnpm run deploy:rwa:polygon   # TokenableRWA → Polygon mainnet (137)
pnpm run deploy:rwa:mainnet   # TokenableRWA → Ethereum mainnet (1)
```

Update `CHAIN_{id}_*` in `backend/.env` and `NEXT_PUBLIC_CHAIN_*` in `frontend/.env`, then refresh the address table in **[docs/architecture/blockchain.md](docs/architecture/blockchain.md)**.

### 6. Run the application

```bash
# Terminal 1 — Backend (port 4100 in local dev — see local-setup.md)
cd backend && pnpm start:dev

# Terminal 2 — Frontend (port 3000)
cd frontend && pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and connect your wallet.  
Swagger: [http://localhost:4100/api/docs](http://localhost:4100/api/docs)

### LAN access (same WiFi)

1. Find your machine's IP (e.g. `192.168.45.101`) and open `http://<IP>:3000`.
2. Add your IP to `backend/.env` `CORS_ORIGIN`:
   ```
   CORS_ORIGIN=http://localhost:3000,http://192.168.45.101:3000
   ```
3. Restart the backend. The frontend auto-detects the host and calls the API at `<IP>:4100`.

---

## Future work

- **Vault system** — PSA inbound custody, evidence, platform-orchestrated mint (architecture assessed; not yet implemented).
- Marketplace fees, auctions, multi-chain, NFT V2 contract (MINTER_ROLE), etc.

---

## License

Proprietary. All rights reserved.
