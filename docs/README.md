# Tokenable RWA Marketplace — Documentation

A non-custodial marketplace for **graded trading-card RWAs** on Ethereum Sepolia.  
Users mint **PSA 10** graded cards via IPFS (PSA cert lookup / slab OCR → Pinata), list them, and trade with USDC via **Seaport 1.5** off-chain orders. External market pricing is **materialized** in PostgreSQL (`collection_market_snapshots`) and refreshed by Cardhedger snapshot workers — not pulled on every page view. Portfolio value history is stored in **`portfolio_daily_snapshots`** (daily **09:00 KST** cron over on-chain holders).

### Branches & deploy

- **`develop`** — Default integration branch. Pushing here runs GitHub Actions (build both images → ECR → dev EC2). Treat **local `develop` matching `origin/develop`** as the current app revision for day-to-day deploys.
- **`main`** — When `PROD_EC2_*` is configured, pushes here deploy the **prod** host with `:main` images.

Details and secrets checklist: **[guides/deployment.md](guides/deployment.md)** · Same-origin Nginx/TLS/OAuth: **[guides/networking.md](guides/networking.md)**.

---

## Repository

```
tokenable-dev/
├── backend/    # NestJS REST API (port 4000)
├── frontend/   # Next.js 16 App Router (port 3000)
├── contracts/  # Hardhat — TokenableRWA (ERC-721) + MockUSDC (ERC-20)
└── docs/       # This documentation
```

## Quick Links

| What | Where |
|------|-------|
| Local setup | [guides/local-setup.md](guides/local-setup.md) |
| Database & snapshots | [architecture/database.md](architecture/database.md) |
| All API routes | [api/README.md](api/README.md) |
| Frontend routes | [frontend/routes.md](frontend/routes.md) |
| Deploy & CI/CD (EC2 / Actions) | [guides/deployment.md](guides/deployment.md) |
| CORS · TLS · same-origin `/api` | [guides/networking.md](guides/networking.md) |
| Live Swagger UI | `http://localhost:4000/api/docs` (when running) |

## Core Technologies

| Layer | Stack |
|-------|-------|
| Frontend | Next.js 16, React 19, wagmi, viem, TanStack Query, Zustand, Tailwind CSS |
| Backend | NestJS 11, TypeORM, PostgreSQL, Ethers.js 6 |
| Blockchain | Ethereum Sepolia — Seaport 1.5, ERC-721 (TokenableRWA), ERC-20 (MockUSDC) |
| Storage | Pinata (IPFS) |
| Market data | Cardhedger API, PSA Public API |
| Infrastructure | Docker Compose, Nginx, AWS ECR + EC2 |
