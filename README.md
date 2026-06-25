# Tokenable RWA Marketplace

A decentralized marketplace for graded-card RWAs on EVM chains (Sepolia-first). Users mint **PSA 10** cards via IPFS, list, and trade with USDC. Settlement is **OpenSea Seaport 1.5** (signed off-chain orders in Postgres). External pricing is **materialized** from Cardhedger into `collection_market_snapshots` ([docs/architecture/database.md](docs/architecture/database.md)). Monorepo: Next.js frontend + Nest backend + Hardhat contracts.

---

## Project Description

Full-stack marketplace for graded-card RWAs on EVM testnets (Sepolia): mint, discover collections, trade with USDC via **Seaport 1.5** off-chain orders. External market references come from the **Cardhedger** API (catalog, mint previews, PSA-10 price history, AI insights, Top 100 / Top Movers) — proxied through the Nest backend. Landing **Market Indexes** use **Card Ladder** scrape + cache.

### What users see today

| Area | Notes |
|------|--------|
| **Landing (`/`)** | Hero + **Market Indexes** (Card Ladder aggregates / sparklines per category). |
| **Markets (`/markets`)** | All collections (including zero listings), sorted by pool pricing; category chips; grid/list view; **Trending** strip. Legacy `/exchange` redirects here. |
| **Markets Top 100 (`/markets/top100`)** | Cardhedger-backed daily sales rank (PSA 10); category tabs; card detail pages. |
| **Collection detail (`/marketplace/collections/[key]`)** | Order book, dual price chart, listing strip, Cardhedger AI insight, schema/identifiers. |
| **Portfolio (`/portfolio`)** | Holdings with listing vs unlisted distinction, daily value chart, hide holdings, reference vs on-platform pricing. |
| **Watchlist (`/watchlist`)** | Saved collections (JWT). |
| **Vault / mint (`/vault`)** | PSA-oriented graded metadata → IPFS → on-chain mint (Vault inbound workflow is planned separately). |
| **Marketplace admin (`/marketplace/admin/*`)** | Separate admin login — collections, cards, Top 100 preview, Top Movers preview, price webhooks. |
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
- **Cardhedger** — Live card/game pricing, mint previews, Top 100, Top Movers, `/api/cardhedger/v1/*` proxy (`CARDHEDGER_API_KEY` required)
- **PSA Public API** — Cert lookup + slab OCR (`PSA_PUBLIC_API_TOKEN`)
- **Pinata** — IPFS pinning for RWA metadata/images
- **PostgreSQL + TypeORM** — 17 entities / ~17 tables ([docs/architecture/database.md](docs/architecture/database.md))
- **Redis** (optional) — Collection identity cache L2

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
├── frontend/       # Next.js App Router (port 3000)
├── backend/        # NestJS API (port 4000 prod / 4100 local dev)
├── contracts/      # Hardhat — TokenableRWA (ERC-721), MockUSDC (ERC-20)
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
| **contracts** | TokenableRWA + MockUSDC — listing & matching via Seaport ([docs/api/marketplace.md](docs/api/marketplace.md)) |
| **docs** | Canonical documentation index — start at [docs/README.md](docs/README.md) |

---

## Documentation

| Document | Contents |
|----------|----------|
| **[docs/README.md](docs/README.md)** | Documentation index · branches/deploy · quick links |
| **[docs/api/README.md](docs/api/README.md)** | **`/api/*`** overview · links to scoped API docs |
| **[docs/architecture/overview.md](docs/architecture/overview.md)** | High-level system layout |
| **[docs/architecture/database.md](docs/architecture/database.md)** | PostgreSQL schema (17 tables) |
| **[docs/frontend/routes.md](docs/frontend/routes.md)** | App Router route reference |
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

- `backend/.env` — RPC, Postgres, Redis, Pinata, JWT/Google, Cardhedger, PSA keys (`RWA_CONTRACT_ADDRESS` required)
- `frontend/.env` — `NEXT_PUBLIC_*` only (`NEXT_PUBLIC_RWA_CONTRACT_ADDRESS`, `NEXT_PUBLIC_USDC_CONTRACT_ADDRESS`, `NEXT_PUBLIC_ALCHEMY_RPC_URL` required)
- `contracts/.env` — deploy `DEPLOYER_PRIVATE_KEY`, `SEPOLIA_RPC_URL`

See **[docs/guides/local-setup.md](docs/guides/local-setup.md)** for a full template.

### 4. Start infrastructure

```bash
docker compose up -d postgres redis
```

### 5. Deploy smart contracts (optional)

Contracts may already be deployed on Sepolia. To redeploy:

```bash
cd contracts
pnpm run deploy:usdc      # MockUSDC → Sepolia
pnpm run deploy:rwa       # TokenableRWA → Sepolia
```

Update `backend/.env` and `frontend/.env` with the deployed contract addresses.

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
