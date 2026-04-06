# Database schema

There are **no hand-written SQL migrations** in this repo.

- **Source of truth**: TypeORM entities under `backend/src/**/entities/*.ts`.
- **Local / non-production**: `app.module.ts` uses `synchronize: true` when `NODE_ENV !== 'production'`, so the backend creates or updates tables on startup.
- **Production**: set `NODE_ENV=production` and `synchronize: false`, then use your own tooling (e.g. TypeORM migrations generated from entities, or a managed migration pipeline).

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

적용 후 `\dt` 로 `users`, `orders`, `marketplace_collections` 가 보이는지 확인하고, **`TYPEORM_SYNC`는 끄거나 제거**한 뒤 백엔드를 재시작하세요.
