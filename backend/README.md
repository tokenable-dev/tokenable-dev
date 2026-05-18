# Backend (NestJS)

```bash
pnpm install
pnpm start:dev
```

- API: [http://localhost:4000/api](http://localhost:4000/api) · Swagger: [http://localhost:4000/api/docs](http://localhost:4000/api/docs)
- Env: `backend/.env` (Postgres, RPC, Pinata, OAuth, etc.)

**Database:** schema comes from TypeORM entities; no `sql/migrations` folder. See **[sql/README.md](./sql/README.md)** and **[../docs/README.md](../docs/README.md)**.

**Marketplace:** Seaport off-chain orders (`MarketplaceService`, `marketplace.controller.ts`), **PokéTrace proxy** (`poketrace-proxy.controller.ts`, `src/poketrace/*`), collection **batch snapshots** (`POST …/collections/market-snapshots`), plus optional **relational trading** (`src/marketplace/trading/*`). Overview: **[../docs/api/marketplace.md](../docs/api/marketplace.md)** · Docs index: **[../docs/README.md](../docs/README.md)**.

**Card Hedge:** optional **`CARDHEDGER_API_KEY`** — each upstream operation is a **named route** under **`/api/cardhedger/v1/...`** (see Swagger tags **Card Hedge · …**). Catalog: **`GET /api/cardhedger/catalog`**. Override base URL with **`CARDHEDGER_BASE_URL`** if needed.
