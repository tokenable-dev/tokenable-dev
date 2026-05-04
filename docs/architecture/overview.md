# System Overview

## Architecture at a Glance

```
Browser / Wallet (MetaMask)
        │
        ▼
  Nginx (port 80/443)
  ├── /         → Next.js frontend  (port 3000)
  └── /api/*    → NestJS backend    (port 4000)
                        │
              ┌─────────┼──────────────┐
              ▼         ▼              ▼
         PostgreSQL  Ethereum RPC   External APIs
         (TypeORM)   (Alchemy)      Cardhedger
                                    PSA Public API
                                    Pinata IPFS
```

## Request Flow

1. **Browser** calls same-origin `/api/*` through Nginx (no hard-coded API host in production).
2. **NestJS** validates the request via `ValidationPipe`, applies JWT auth where required, and routes to the appropriate module.
3. **PostgreSQL** (TypeORM) persists orders, collections, users, and the relational trading layer.
4. **Ethereum RPC** (Alchemy Sepolia) provides read-only contract data. On-chain settlement uses **Seaport 1.5** via wallet-signed transactions in the browser.
5. **Cardhedger API** supplies catalog search, PSA-10 price data, and market indexes.
6. **PSA Public API** verifies cert numbers and provides slab metadata.
7. **Pinata** stores IPFS metadata and images.

## Service Topology (Docker Compose)

| Container | Image | Port |
|-----------|-------|------|
| `tokenable-frontend` | ECR `tokenable-frontend` | 3000 (internal) |
| `tokenable-backend` | ECR `tokenable-backend` | 4000 (internal) |
| `tokenable-postgres` | `postgres:16-alpine` | 5432 (internal) |
| `tokenable-nginx` | `nginx:alpine` | 80, 443 (public) |

Local development omits Nginx; the frontend dev server proxies `/api` to `localhost:4000`.

## Two Trading Axes

| Axis | Storage | Settlement | Entry Point |
|------|---------|-----------|-------------|
| **Seaport** | `orders`, `marketplace_collections` | Wallet-signed on-chain `fulfillOrder` / `matchAdvancedOrders` | `marketplace/orders/*` API + `frontend/lib/seaport/*` |
| **Relational** | `bids`, `asks`, `match_intents`, `trade_executions`, `idempotency_keys`, `outbox_events` | Settlement worker: `pending → locked → executed/failed` | `marketplace/bids` + `marketplace/trade/*` API |

The two axes share the same PostgreSQL instance and can coexist. The primary product UI uses Seaport.

## Key Environment Variables

| Variable | Service | Purpose |
|----------|---------|---------|
| `RWA_CONTRACT_ADDRESS` | backend | TokenableRWA on Sepolia |
| `USDC_CONTRACT_ADDRESS` | backend | MockUSDC on Sepolia |
| `SEPOLIA_RPC_URL` | backend | Alchemy RPC |
| `CARDHEDGER_API_KEY` | backend | Cardhedger market data |
| `PSA_PUBLIC_API_TOKEN` | backend | PSA cert lookup |
| `PINATA_JWT` + `PINATA_GATEWAY` | backend | IPFS upload & read |
| `JWT_SECRET` | backend | JWT signing |
| `GOOGLE_CLIENT_ID/SECRET` | backend | Google OAuth |
| `NEXT_PUBLIC_RWA_CONTRACT_ADDRESS` | frontend | Baked into bundle at Docker build |
| `NEXT_PUBLIC_ALCHEMY_RPC_URL` | frontend | Browser-side RPC |

Full variable reference: [guides/local-setup.md](../guides/local-setup.md).
