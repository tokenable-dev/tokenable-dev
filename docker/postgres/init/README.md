This directory is intentionally **empty**.

PostgreSQL schema is created by:

1. **Local dev** — NestJS TypeORM `synchronize: true` on backend boot (`NODE_ENV !== production`)
2. **Production** — `backend/sql/scripts/bootstrap-db.sh` (see [backend/sql/README.md](../../../backend/sql/README.md))

No `docker-entrypoint-initdb.d` SQL scripts are required for app tables. Docker Compose mounts this folder for optional one-off DBA setup (runs only on **first** container init for a new data volume).

**Canonical schema:** [docs/architecture/database.md](../../../docs/architecture/database.md)
