This directory is intentionally **empty**.

PostgreSQL schema is created by the **NestJS backend** via TypeORM `synchronize` in development (`NODE_ENV !== 'production'`). No `docker-entrypoint-initdb.d` SQL scripts are required for app tables.

If you need extensions or one-off DBA setup for production, add numbered `.sql` files here (they run only on **first** container init for a new data volume).
