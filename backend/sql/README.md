# Database schema

Optional **manual SQL** files in this folder supplement TypeORM for production (`synchronize: false`) or one-off fixes. The canonical model remains entities under `backend/src/**/entities/*.ts`.

- **Local / non-production**: `app.module.ts` uses `synchronize: true` when `NODE_ENV !== 'production'`, so the backend creates or updates tables on startup.
- **Production**: set `NODE_ENV=production` and `synchronize: false`, then apply entity-aligned DDL (see below) or your migration pipeline.

### Collection enrichment (PSA cert, market bundle cache)

Apply when upgrading an existing Postgres without TypeORM sync:

```bash
psql … -f backend/sql/marketplace_collections_enrichment_cache.sql
```

Optional env (defaults are safe):

| Variable | Purpose |
|----------|---------|
| `MARKET_BUNDLE_CACHE_SEC` | Cardhedger-heavy `GET …/market-series` cache TTL; `0` disables. Default **120** seconds in code. |
| `PSA_PUBLIC_SNAPSHOT_DB_TTL_SEC` | How long to keep `psa_public_snapshot_json` before refreshing from PSA API (min 60). Default **7 days** in code. |

---

## Reset PostgreSQL completely (local Docker)

Schema is recreated when the backend starts with `synchronize` enabled.

1. Stop containers: `docker compose down` (from repo root).
2. Remove the named volume so Postgres starts empty (`postgres_data` in `docker-compose.yml`):

   ```bash
   docker volume rm tokenable-dev_postgres_data
   ```

   (Prefix `tokenable-dev_` may differ; use `docker volume ls` to find the exact name.)

3. Start Postgres again: `docker compose up -d postgres`.
4. Start the Nest app: `cd backend && pnpm start:dev` — tables are created from entities.

If you use a **local Postgres** without Docker, drop and recreate the database or drop all tables in the target schema, then restart the backend.

---

## Empty production DB (`\dt` shows no relations)

`TYPEORM_SYNC=true` 인데도 테이블이 없으면, 배포 중인 백엔드 이미지가 해당 분기를 포함하지 않았거나 동기화가 실패한 경우가 있습니다. **수동으로 한 번 스키마를 넣을 수 있습니다** (레포의 `bootstrap-empty-prod-db.sql`).

서버에서 레포 `~/app` 기준:

```bash
docker exec -i tokenable-postgres psql -U tokenable -d tokenable < /home/ubuntu/app/backend/sql/bootstrap-empty-prod-db.sql
```

적용 후 `\dt` 로 `users`, `orders`, `marketplace_collections` 가 보이는지 확인하고, **`TYPEORM_SYNC`는 끄거나 제거**한 뒤 백엔드를 재시작하세요. (최신 엔티티가 포함된 이미지라면 `bids`, `asks`, `match_intents`, `trade_executions` 등도 나타날 수 있습니다 — [docs/api/marketplace.md](../../docs/api/marketplace.md).)

---

## Dev: chart / platform trade history (about 2 months)

컬렉션 상세·Exchange 차트의 **플랫폼(온체인 체결) 시계열**은 DB의 `orders` 중 `fulfilled` **ask**를 씁니다. 로컬에서 곡선만 빠르게 보고 싶으면 `seed-dev-platform-chart-fills.sql`로 과거 체결처럼 보이는 행을 넣을 수 있습니다(재실행 시 `_seedChart` 로 넣었던 행만 지우고 다시 삽입).

```bash
# repo root, Docker Postgres
docker exec -i tokenable-postgres psql -U tokenable -d tokenable < backend/sql/seed-dev-platform-chart-fills.sql
```

파일 상단의 `rwa_contract` / `usdc_contract` 는 `backend/.env` 와 맞추세요. `marketplace_collections` 에 행이 하나 있어야 하며, 가능하면 해당 컬렉션에 맞는 `token_id` 를 기존 주문에서 재사용합니다.
