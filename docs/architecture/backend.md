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
├── blockchain/              # Sepolia read-only: USDC + TokenableRWA + IPFS resolver
│   ├── blockchain.controller.ts
│   ├── blockchain.service.ts
│   ├── blockchain.module.ts
│   ├── ipfs-gateway-resolver.service.ts
│   ├── abis/                # erc20.abi.ts + tokenable-rwa.abi.ts
│   ├── constants/injection-tokens.ts
│   ├── dto/media-resolve.dto.ts + rwa-metadata-batch.dto.ts
│   └── providers/           # ethers-provider.factory + tokenable-rwa.factory + usdc.factory
│
├── psa/                     # PSA slab OCR + Public API cert lookup
│   ├── psa.controller.ts
│   ├── psa.service.ts
│   ├── psa.module.ts
│   ├── psa-public-api.service.ts
│   └── utils/               # psa-cert-images.util + psa-ocr.util + psa-slab-crop.util
│
├── cardhedger/              # Cardhedger API proxy + market indexes
│   ├── cardhedger.module.ts
│   ├── cardhedger.service.ts
│   ├── cardhedger.registry.ts
│   ├── indexes.service.ts   # 24-hour scheduled refresh + disk cache
│   └── controllers/         # catalog · details · download · image · indexes ·
│                            #   issues · market · pricing · search
│
└── marketplace/
    ├── marketplace.module.ts
    │
    ├── orders/              # Seaport off-chain order book
    │   ├── orders.controller.ts
    │   ├── orders.service.ts
    │   └── dto/             # create-order · replace-listing · orders-batch-by-token · fulfill-matched-pair
    │
    ├── collections/         # Collections, charts, snapshots, Cardhedger helpers, AI insight
    │   ├── collections.controller.ts
    │   ├── collection.service.ts
    │   ├── collection-market.service.ts
    │   ├── cardhedger-market-data.service.ts
    │   ├── cardhedger-ai-insight.service.ts
    │   └── dto/             # batch-market-snapshots · mint-previews-by-token-ids
    │
    ├── assets/              # Portfolio hidden-asset management
    │   ├── assets.controller.ts
    │   └── hidden-assets.service.ts
    │
    ├── trading/             # Relational matching layer (bids, asks, settlement)
    │   ├── bids.controller.ts
    │   ├── trade.controller.ts
    │   ├── bids-query.service.ts
    │   ├── trade-orchestrator.service.ts
    │   ├── trade-execution-query.service.ts
    │   ├── settlement-processor.service.ts
    │   ├── outbox-publisher.service.ts
    │   ├── rule-engine.service.ts
    │   ├── token-resolution.service.ts
    │   ├── enums.ts
    │   ├── rule-ast.types.ts
    │   └── token-rule-view.ts
    │
    ├── entities/            # TypeORM entities (9)
    │   ├── order.entity.ts
    │   ├── marketplace-collection.entity.ts
    │   ├── bid.entity.ts + ask.entity.ts
    │   ├── match-intent.entity.ts + trade-execution.entity.ts
    │   ├── idempotency-key.entity.ts + outbox-event.entity.ts
    │   └── hidden-asset.entity.ts
    │
    ├── utils/               # Pure utilities (11 files)
    │   ├── bucket-key.util.ts        # Collection key SHA-256 derivation
    │   ├── card-match.util.ts
    │   ├── collection-image.util.ts
    │   ├── collection-label.util.ts
    │   ├── collection-market-stats.util.ts
    │   ├── collection-market.util.ts
    │   ├── market-grade-strip.util.ts
    │   ├── market-history-tier.util.ts
    │   ├── market-reference.types.ts
    │   ├── order-list.util.ts
    │   └── price-history-period.util.ts
    │
    └── dto/
        ├── match-accepted.response.ts
        └── trade-match.dto.ts
```

## Global Bootstrap (`main.ts`)

| Setting | Value |
|---------|-------|
| Global prefix | `/api` |
| Swagger UI | `GET /api/docs` |
| ValidationPipe | `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` |
| CORS | Origins from `CORS_ORIGIN` env (comma-separated); `credentials: true` |
| Cookie parser | `cookie-parser` middleware |
| Default port | `4000` (override with `PORT` env) |
