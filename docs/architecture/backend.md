# Backend Structure

**Source:** `backend/src/`  
**Framework:** NestJS 11 + TypeORM + Ethers.js 6

## Module Map

```
backend/src/
├── main.ts                  # Bootstrap: global prefix /api, CORS, ValidationPipe, Swagger
├── app.module.ts            # Root module — imports all domain modules
│
├── auth/                    # Google OAuth, JWT cookies, session, wallet link
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.module.ts
│   ├── dto/link-wallet.dto.ts
│   ├── guards/jwt-auth.guard.ts
│   └── strategies/google.strategy.ts + jwt.strategy.ts
│
├── user/
│   ├── user.service.ts
│   ├── user.module.ts
│   └── entities/user.entity.ts
│
├── mail/
│   ├── mail.service.ts      # SMTP via Nodemailer (used by auth for verification emails)
│   └── mail.module.ts
│
├── rwa/                     # IPFS RWA upload (Pinata)
│   ├── rwa.controller.ts
│   ├── rwa.service.ts
│   ├── rwa.module.ts
│   ├── pinata/pinata.service.ts
│   ├── dto/upload-rwa.dto.ts
│   └── interfaces/rwa-metadata.interface.ts
│
├── blockchain/              # Sepolia read-only: TokenableRWA + IPFS resolver
│   ├── blockchain.controller.ts
│   ├── blockchain.service.ts
│   ├── blockchain.module.ts
│   ├── ipfs-gateway-resolver.service.ts
│   ├── abis/tokenable-rwa.abi.ts
│   ├── constants/injection-tokens.ts
│   ├── dto/media-resolve.dto.ts + rwa-metadata-batch.dto.ts
│   └── providers/           # ethers-provider.factory + tokenable-rwa.factory
│
├── psa/                     # PSA slab OCR + Public API + optional spec-page scraper
│   ├── psa.controller.ts
│   ├── psa.service.ts
│   ├── psa.module.ts
│   ├── psa-public-api.service.ts
│   ├── psa-spec-scraper.service.ts
│   └── utils/               # psa-cert-images.util + psa-ocr.util + psa-slab-crop.util
│
├── cardhedger/              # Cardhedger upstream client + dashboard indexes HTTP
│   ├── cardhedger.module.ts
│   ├── cardhedger.service.ts
│   ├── indexes.service.ts
│   └── controllers/indexes.controller.ts   # GET /api/cardhedger/indexes
│
└── marketplace/
    ├── marketplace.module.ts
    │
    ├── orders/              # Seaport off-chain order book
    │   ├── orders.controller.ts
    │   ├── orders.service.ts
    │   └── dto/
    │
    ├── collections/         # Collections, charts, snapshots, Cardhedger helpers, AI insight
    │   ├── collections.controller.ts
    │   ├── collection.service.ts
    │   ├── collection-market.service.ts
    │   ├── cardhedger-market-data.service.ts
    │   ├── cardhedger-ai-insight.service.ts
    │   └── dto/
    │
    ├── assets/              # Portfolio hidden-asset management
    │   ├── assets.controller.ts
    │   └── hidden-assets.service.ts
    │
    ├── entities/            # TypeORM: order, marketplace_collection, hidden_asset
    │   ├── order.entity.ts
    │   ├── marketplace-collection.entity.ts
    │   └── hidden-asset.entity.ts
    │
    ├── utils/               # bucket-key, collection-image, card-match, psa-spec-cardhedger-map, …
    │
    └── (no dto/ at module root)

## Global Bootstrap (`main.ts`)

| Setting | Value |
|---------|-------|
| Global prefix | `/api` |
| Swagger UI | `GET /api/docs` |
| ValidationPipe | `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` |
| CORS | Origins from `CORS_ORIGIN` env (comma-separated); `credentials: true` |
| Cookie parser | `cookie-parser` middleware |
| Default port | `4000` (override with `PORT` env) |
