# Backend (NestJS)

```bash
pnpm install
pnpm start:dev
```

- API: [http://localhost:4000/api](http://localhost:4000/api) · Swagger: [http://localhost:4000/api/docs](http://localhost:4000/api/docs)
- Env: `backend/.env` (Postgres, RPC, Pinata, OAuth, etc.)

**Database:** schema comes from TypeORM entities; no `sql/migrations` folder. See **[sql/README.md](./sql/README.md)** and **[../docs/DEVELOPMENT.md](../docs/DEVELOPMENT.md)**.

**Marketplace:** Seaport off-chain orders (`MarketplaceService`, `marketplace.controller.ts`) plus optional **relational trading** (`src/marketplace/trading/*`, `bids` / `asks` / `match_intents` / `trade_executions`). Overview: **[../docs/marketplace-trading.md](../docs/marketplace-trading.md)**.
