# Backend (NestJS)

```bash
pnpm install
pnpm start:dev
```

- API: [http://localhost:4000/api](http://localhost:4000/api) · Swagger: [http://localhost:4000/api/docs](http://localhost:4000/api/docs)
- Env: `backend/.env` (Postgres, RPC, Pinata, OAuth, etc.)

**Database:** schema comes from TypeORM entities; no `sql/migrations` folder. See **[sql/README.md](./sql/README.md)** and **[../docs/DEVELOPMENT.md](../docs/DEVELOPMENT.md)**.

**Marketplace:** Seaport off-chain orders (`MarketplaceService`, `marketplace.controller.ts`), **PokéTrace proxy** (`poketrace-proxy.controller.ts`, `src/poketrace/*`), collection **batch snapshots** (`POST …/collections/market-snapshots`), plus optional **relational trading** (`src/marketplace/trading/*`). Overview: **[../docs/marketplace-trading.md](../docs/marketplace-trading.md)** · 통합 가이드: **[../docs/DEVELOPMENT.md](../docs/DEVELOPMENT.md)**.

**Price:** JustTCG integration — **`TCG_API_KEY` required** in `backend/.env` (`PriceService`).
