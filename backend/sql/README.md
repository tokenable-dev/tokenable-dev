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
