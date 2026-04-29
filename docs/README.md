# Tokenable RWA Marketplace — Documentation

A non-custodial marketplace for **graded trading-card RWAs** on Ethereum Sepolia.  
Users mint cards via IPFS (PSA slab OCR → Pinata), list them, and trade with USDC via **Seaport 1.5** off-chain orders. Market pricing is sourced from the **Cardhedger** API.

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
| All API routes | [api/README.md](api/README.md) |
| Frontend routes | [frontend/routes.md](frontend/routes.md) |
| EC2 deployment | [guides/deployment.md](guides/deployment.md) |
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
