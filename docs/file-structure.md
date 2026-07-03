# File Structure

Repository layout and folder ownership. Read this before adding new files.

---

## Monorepo Root

```
tokenable-dev/
├── .cursor/                    # Cursor IDE configuration
│   ├── rules/                  # AI coding rules (.mdc files)
│   └── project-constitution.md # AI constitution
├── .github/
│   └── workflows/
│       ├── deploy.yml          # CI/CD: build → ECR → EC2
│       └── backend-ci.yml      # Backend PR checks (lint + tests)
├── backend/                    # NestJS backend service
├── contracts/                  # Solidity smart contracts (Hardhat)
├── docs/                       # All documentation
├── frontend/                   # Next.js 16 frontend
├── nginx/                      # Nginx config files
│   ├── nginx.conf              # HTTP (dev/initial)
│   └── nginx.tls.conf          # HTTPS (production after certbot)
├── docker-compose.yml          # Base compose (postgres, redis, nginx, services)
├── docker-compose.ec2.yml      # EC2 overlay (env_file, ECR image tags)
├── docker-compose.local.yml    # Local overlay (loads backend/.env)
├── ARCHITECTURE_INDEX.md       # Navigation guide for humans and AI
└── README.md                   # Project overview
```

---

## Backend (`backend/src/`)

```
backend/src/
├── main.ts                     # App bootstrap (Swagger, guards, pipes, cors)
├── app.module.ts               # Root module — wires all modules + TypeORM
│
├── config/                     # NestJS ConfigModule factories
│   ├── app.config.ts           # PORT, NODE_ENV, CORS, JWT, Privy
│   ├── marketplace.config.ts   # Admin wallets, scan limits
│   └── cardladder.config.ts    # Card Ladder cache settings
│
├── common/                     # Framework-level cross-cutting concerns
│   ├── cache/                  # MemoryTtlCacheProvider (TTL_CACHE_PROVIDER)
│   ├── metrics/                # CardhedgerMetricsModule
│   └── perf/                   # perfNow, perfLog, elapsedMs
│
├── auth/                       # User authentication
│   ├── auth.controller.ts      # /api/auth/* (Privy session, logout, delete)
│   ├── auth.service.ts         # JWT issuance, delete account
│   ├── auth-session.util.ts    # Session parsing helpers
│   ├── dto/                    # Auth request DTOs
│   ├── entities/               # VerificationToken entity
│   ├── guards/                 # JwtAuthGuard
│   ├── privy/                  # PrivyService, profile parser, types
│   └── strategies/             # JwtStrategy (passport-jwt)
│
├── privy/                      # Privy API proxy + feature catalog
│   ├── privy.module.ts
│   ├── privy-api.controller.ts # /api/privy/... (admin proxy)
│   ├── privy-catalog.controller.ts
│   ├── privy-catalog.ts
│   ├── privy-funding.util.ts
│   └── dto/
│
├── user/                       # User management
│   ├── user.service.ts         # findOrCreateFromPrivy, syncWallets, KYC
│   ├── user.module.ts
│   └── entities/
│       ├── user.entity.ts
│       ├── user-wallet.entity.ts
│       ├── user-auth-provider.entity.ts
│       └── user-kyc-event.entity.ts
│
├── rwa/                        # Vault mint pipeline
│   ├── rwa.controller.ts       # /api/rwa/upload, /mint, /redeem-request
│   ├── rwa.service.ts          # IPFS upload + PSA 10 gate
│   ├── rwa-mint.service.ts     # Orchestrate cycle → mint to custody
│   ├── rwa-redeem.service.ts   # Redemption request
│   ├── rwa.module.ts
│   ├── dto/
│   │   ├── mint-rwa.dto.ts
│   │   └── redeem-request.dto.ts
│   └── pinata/
│       ├── pinata.service.ts
│       └── pinata-filename.util.ts
│
├── vault/                      # Physical card vault DB state machine
│   ├── vault.service.ts        # reserveCycleForDeposit, recordMintResult, etc.
│   ├── vault.module.ts
│   └── entities/
│       ├── vault-asset.entity.ts
│       ├── vault-cycle.entity.ts
│       └── vault-redemption.entity.ts
│
├── blockchain/                 # On-chain reads + writes
│   ├── blockchain.service.ts   # Read-only: ownerOf, tokenURI, batch
│   ├── blockchain.module.ts
│   ├── chain-config.service.ts # Per-chain RPC + contract config
│   ├── rwa-chain-writer.service.ts  # mintTo, adminBurn, safeTransferFromCustody
│   ├── rwa-asset-resolve.service.ts
│   ├── ipfs-gateway-resolver.service.ts
│   ├── abis/
│   │   └── tokenable-rwa.abi.ts     # ABI synced from contracts/ via pnpm sync-abi
│   └── providers/
│       ├── ethers-provider.factory.ts
│       └── tokenable-rwa.factory.ts
│
├── psa/                        # PSA API integration
│   ├── psa.controller.ts       # /api/psa/* (analyze, analyze-by-cert, proxied endpoints)
│   ├── psa.service.ts          # Slab OCR, cert analysis orchestration
│   ├── psa-public-api.service.ts  # Multi-token pool, rate limit handling
│   ├── psa-rate-limit.exception.ts
│   ├── psa.module.ts
│   └── dto/
│
├── cardhedger/                 # Cardhedger integration
│   ├── cardhedger.service.ts   # forwardJson upstream client
│   ├── cardhedger.module.ts
│   ├── cardhedger-price-infra.module.ts
│   ├── controllers/            # proxy, top100, top-movers, catalog, webhook
│   ├── entities/               # price infra TypeORM entities
│   └── admin/
│       └── CardhedgerAdminModule  # /api/admin/cardhedger/*
│
├── cardladder/                 # Card Ladder indexes
│
├── mail/                       # Legacy SMTP (admin tooling only)
│   └── templates/
│
├── site-access/                # Staging password gate
│   ├── site-access.middleware.ts
│   └── site-access.controller.ts
│
├── health/                     # GET /api/health
│
├── swagger/                    # Swagger configuration
│   ├── swagger-tags.util.ts
│   ├── fixtures.ts             # Example contract addresses, token IDs
│   └── examples.ts
│
└── marketplace/                # Marketplace domain (6 submodules)
    ├── marketplace.module.ts   # Facade module
    ├── admin/                  # Admin auth + user admin
    ├── entities/               # All marketplace TypeORM entities
    ├── utils/                  # Business logic utilities
    │   ├── bucket-key.util.ts  # computeMarketBucketKey v2
    │   ├── psa-components-mirror.util.ts
    │   └── psa-upstream-policy.util.ts
    ├── orders/
    ├── collections/
    │   ├── rwa-token-admin.controller.ts  # Admin RWA ops
    │   ├── rwa-token-admin.service.ts
    │   └── ...
    ├── market-data/
    ├── snapshots/
    ├── portfolio/
    └── watchlist/
```

### Ownership rules

| Folder | Owner |
|--------|-------|
| `auth/`, `privy/`, `user/` | Auth / identity domain |
| `rwa/`, `vault/` | Vault lifecycle domain |
| `blockchain/` | On-chain read/write abstraction |
| `psa/` | PSA API integration |
| `cardhedger/` | Pricing data pipeline |
| `marketplace/` | Marketplace features |
| `common/` | Platform cross-cutting (perf, cache, metrics) |

---

## Frontend (`frontend/`)

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout (providers, header, analytics)
│   ├── page.tsx            # Landing page
│   ├── globals.css
│   ├── providers.tsx       # Root provider tree
│   ├── login/              # /login → PrivyAuthEntryPage
│   ├── signup/             # /signup → PrivyAuthEntryPage
│   ├── vault/              # /vault → MintForm stepper
│   ├── portfolio/          # /portfolio
│   ├── profile/            # /profile
│   ├── watchlist/          # /watchlist
│   ├── markets/            # /markets, /markets/top100/...
│   ├── marketplace/
│   │   ├── collections/    # /marketplace/collections/[collectionKey]
│   │   ├── [tokenId]/      # /marketplace/[tokenId]
│   │   ├── other-listings/ # /marketplace/other-listings
│   │   └── admin/          # /marketplace/admin/* (all admin pages)
│   │       ├── custody-nfts/
│   │       └── vault/
│   ├── site-access/        # Staging gate entry
│   └── dev/privy/          # Dev-only Privy features lab
│
├── components/             # React components
│   ├── auth/               # PrivyAuthEntryPage, HeaderAuthModals, DeleteAccountSettings
│   ├── charts/             # EChartsSized reusable chart wrapper
│   ├── landing/            # Hero, offers, index sections
│   ├── layout/             # AppHeader, HeaderAuthControls, nav
│   ├── markets/            # Markets page, Top 100, CollectionGridCard
│   ├── marketplace/
│   │   ├── admin/          # All admin page components
│   │   ├── collection-detail/
│   │   ├── collection-trading/
│   │   ├── rwa-detail/
│   │   └── ...
│   ├── network/            # NetworkSwitcher
│   ├── portfolio/
│   ├── privy/              # PrivyUserPill, PrivyFeaturesLab
│   ├── ui/                 # Shared UI primitives
│   └── vault/              # MintForm, GradedCardSection, VaultPageBody
│
├── hooks/                  # Custom React hooks
│   ├── auth/               # useAuthSession, usePrivySession
│   ├── marketplace-admin/  # useMarketplaceAdminCards, useMarketplaceAdminCustodyNfts, etc.
│   ├── portfolio/
│   ├── rwa-detail/
│   ├── unified-order-book/
│   ├── vault/              # useMintForm
│   └── ...
│
├── lib/                    # Utilities and API clients
│   ├── core/
│   │   ├── api/            # API client functions (one file per domain)
│   │   ├── queryKeys.ts    # All React Query key factories
│   │   └── invalidation.ts # Centralized cache invalidation after mutations
│   ├── auth/               # accountAccess.ts (access gates)
│   ├── marketplace/        # Market data helpers
│   ├── portfolio/          # Portfolio type definitions
│   ├── privy/              # Privy config, session bridge, signing
│   ├── seaport/            # Order building, signing, fulfillment
│   ├── vault/              # buildMintMetadata, validateMintForm
│   └── network/            # chainGas, chain config
│
├── store/                  # Zustand global stores
│   ├── authStore.ts        # AuthUser, fetchAuthMe, logout
│   ├── authUiStore.ts      # Modal state (sign-in, wallet, KYC)
│   └── index.ts            # AppStore (wallet address, USDC balance)
│
├── constants/              # App-wide constants
│   ├── contracts.ts        # Seaport address, ABI snippets, fee config
│   └── adminUi.ts          # Admin UI tokens
│
├── types/                  # TypeScript type definitions
│   ├── gradedCard.ts
│   └── gtag.d.ts
│
└── providers/              # Legacy alias folder → lib/privy/
```

### Component naming conventions

- **PascalCase** files matching the export: `MarketplaceAdminCustodyNftsPage`
- **Domain prefix** for scoped components: `Marketplace*`, `Collection*`, `RwaDetail*`
- **Page shells** follow patterns: `*PageShell`, `*LoadedView`, `*LoadingShell`
- **Admin components** in `components/marketplace/admin/`
- **Page files** in `app/` are thin — logic in `hooks/` and `components/`

### Hook conventions

- `use` prefix, camelCase file: `useMintForm.ts`
- Grouped under `hooks/{domain}/`
- `"use client"` directive on all hooks
- State machines via `step` unions: `"idle" | "uploading" | "minting" | "success" | "error"`

---

## Contracts (`contracts/`)

```
contracts/
├── contracts/
│   └── TokenableRWA.sol        # Main ERC-721 contract
├── scripts/
│   ├── deploy-tokenable-rwa-uups.ts   # Deploy UUPS proxy
│   ├── upgrade-tokenable-rwa.ts       # Upgrade implementation
│   ├── grant-rwa-burner-role.ts       # Grant BURNER_ROLE
│   └── sync-abi.mjs                   # Copy ABI → backend
├── test/
│   └── TokenableRWA.test.ts    # Comprehensive contract tests
├── .openzeppelin/              # OpenZeppelin upgrade manifests (per network)
├── hardhat.config.ts
├── package.json
└── .env                        # DEPLOYER_PRIVATE_KEY, RPC URLs
```

---

## Docs (`docs/`)

```
docs/
├── README.md                   # Docs index
├── SUMMARY.md                  # GitBook-style table of contents
├── architecture/
│   ├── overview.md             # System architecture
│   ├── backend.md              # Backend module map
│   ├── database.md             # All tables + schema files
│   ├── frontend.md             # Frontend architecture
│   ├── blockchain.md           # Smart contract + chain architecture
│   ├── vault-lifecycle.md      # Vault deposit → mint → deliver → burn
│   └── materialized-market-snapshots.md
├── api/
│   ├── README.md
│   ├── auth.md                 # Auth API (Privy session, session, logout)
│   ├── rwa.md                  # RWA API (upload, mint, redeem-request)
│   ├── marketplace.md          # Marketplace orders + collections + portfolio
│   ├── marketplace-admin.md    # Admin API (custody, deliver, burn, users)
│   ├── blockchain.md           # Blockchain read API
│   ├── psa.md                  # PSA API
│   ├── cardhedger.md           # Cardhedger API
│   └── site-access.md
├── guides/
│   ├── local-setup.md          # Developer setup
│   ├── deployment.md           # EC2 + CI/CD
│   ├── marketplace-admin.md    # Admin console usage
│   ├── privy-auth-migration.md # Auth migration notes
│   ├── privy-wallet-funding.md # Wallet funding setup
│   ├── performance-instrumentation.md
│   ├── cardhedger-psa-variety.md
│   ├── analytics.md
│   ├── networking.md
│   └── troubleshooting.md
├── diagrams/                   # Mermaid lifecycle diagrams
├── business-rules.md           # Core platform invariants
├── security.md                 # Security model
├── testing.md                  # Test strategy
├── error-handling.md           # Error patterns
└── file-structure.md           # This file
```

---

## SQL (`backend/sql/`)

```
backend/sql/
├── bootstrap-empty-prod-db.sql   # Orchestrates all schema/* files in order
├── scripts/
│   └── bootstrap-db.sh          # Shell wrapper for Docker exec
├── schema/
│   ├── 010_users.sql            # Up to 084_*.sql + 900_triggers.sql
│   └── ...
├── maintenance/
│   └── 077_reset_amoy_marketplace_data.sql  # Dev Amoy data reset
├── seed-dev-platform-chart-fills.sql
├── seed-marketplace-admin.sql
└── README.md
```

**Rules:**
- Never edit deployed schema files — add a new numbered migration
- `900_triggers.sql` is idempotent; re-applied in bootstrap
- `maintenance/` files are one-time ops scripts; not in bootstrap
