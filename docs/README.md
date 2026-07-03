# Tokenable RWA Marketplace — Documentation

A non-custodial marketplace for **graded trading-card RWAs** on **Polygon mainnet** (137) and **Polygon Amoy** testnet (80002).  
Users vault **PSA 10** graded cards via IPFS (PSA cert lookup / slab OCR → Pinata); the backend mints an ERC-721 NFT to a **platform custody wallet**, an admin delivers it to the user, and the user trades with USDC via **Seaport 1.5** off-chain orders. External market pricing is **materialized** in PostgreSQL (`collection_market_snapshots`) and refreshed by Cardhedger snapshot workers — not pulled on every page view. Portfolio value history is stored in **`portfolio_daily_snapshots`** (daily **09:00 KST** cron). Hide preferences use **`portfolio_hidden_holdings`**. Authenticated users can save collections in **`user_watchlist`**.

The full physical-card lifecycle (deposit → mint → deliver → trade → redeem → burn) is documented in **[architecture/vault-lifecycle.md](architecture/vault-lifecycle.md)**.

Auth is handled **exclusively by Privy** (email, Google, Apple, embedded wallet, MetaMask via external wallet). Legacy Google OAuth and email/password routes have been **removed** from the user-facing controller — see [api/auth.md](api/auth.md) and [guides/privy-auth-migration.md](guides/privy-auth-migration.md).

### Branches & deploy

- **`develop`** — Default integration branch. Pushing here runs GitHub Actions (build both images → ECR → dev EC2). Treat **local `develop` matching `origin/develop`** as the current app revision for day-to-day deploys.
- **`main`** — When `PROD_EC2_*` is configured, pushes here deploy the **prod** host with `:main` images.

Details and secrets checklist: **[guides/deployment.md](guides/deployment.md)** · Same-origin Nginx/TLS/OAuth: **[guides/networking.md](guides/networking.md)**.

---

## Repository

```
tokenable-dev/
├── backend/      # NestJS REST API (port 4000 prod / 4100 local dev)
├── frontend/     # Next.js 16 App Router (port 3000)
├── contracts/    # Hardhat — TokenableRWA (UUPS ERC-721); USDC is external (Circle)
├── docs/         # This documentation
├── nginx/        # Reverse proxy (HTTP + TLS configs)
└── certbot/      # Let's Encrypt webroot
```

## Start Here (for humans and AI)

| Read this | Purpose |
|-----------|---------|
| **[../ARCHITECTURE_INDEX.md](../ARCHITECTURE_INDEX.md)** | Navigation: "I need to modify X → read these files" |
| **[../AI_WORKFLOW.md](../AI_WORKFLOW.md)** | The step order every task must follow |
| **[../.cursor/project-constitution.md](../.cursor/project-constitution.md)** | Permanent architecture memory + invariants |

## Quick Links

| What | Where |
|------|-------|
| Local setup | [guides/local-setup.md](guides/local-setup.md) |
| Database (22 entities) | [architecture/database.md](architecture/database.md) |
| Backend module map | [architecture/backend.md](architecture/backend.md) |
| Frontend structure | [architecture/frontend.md](architecture/frontend.md) |
| Blockchain / contract | [architecture/blockchain.md](architecture/blockchain.md) |
| Vault lifecycle | [architecture/vault-lifecycle.md](architecture/vault-lifecycle.md) |
| Business rules | [business-rules.md](business-rules.md) |
| All API routes | [api/README.md](api/README.md) |
| Auth API (Privy) | [api/auth.md](api/auth.md) |
| Marketplace admin API | [api/marketplace-admin.md](api/marketplace-admin.md) |
| Frontend routes | [frontend/routes.md](frontend/routes.md) |
| Deploy & CI/CD (EC2 / Actions) | [guides/deployment.md](guides/deployment.md) |
| Security model | [security.md](security.md) |
| Testing strategy | [testing.md](testing.md) |
| Error handling | [error-handling.md](error-handling.md) |
| File structure | [file-structure.md](file-structure.md) |
| Marketplace admin console | [guides/marketplace-admin.md](guides/marketplace-admin.md) |
| Privy auth migration | [guides/privy-auth-migration.md](guides/privy-auth-migration.md) |
| Troubleshooting | [guides/troubleshooting.md](guides/troubleshooting.md) |
| Live Swagger UI | `http://localhost:4100/api/docs` (local dev) |

## Core Technologies

| Layer | Stack |
|-------|-------|
| Frontend | Next.js 16, React 19, **Privy** (`@privy-io/react-auth`), wagmi, viem, TanStack Query, Zustand, Tailwind CSS |
| Backend | NestJS 11, TypeORM, PostgreSQL 16, Redis 7 (optional), Ethers.js 6 |
| Blockchain | Polygon mainnet / Polygon Amoy — Seaport 1.5, UUPS ERC-721 (TokenableRWA), USDC (Circle) |
| Storage | Pinata (IPFS) |
| Market data | Cardhedger API (+ `/api/cardhedger/v1/*` proxy), PSA Public API, Card Ladder scrape |
| Infrastructure | Docker Compose, Nginx, AWS ECR + EC2 |
