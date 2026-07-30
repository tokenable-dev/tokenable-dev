-- Tokenable — canonical PostgreSQL schema (entity-aligned, idempotent).
--
-- Fresh database bootstrap:
--   docker exec -i tokenable-postgres psql -U tokenable -d tokenable \
--     -v ON_ERROR_STOP=1 -f - < backend/sql/bootstrap-empty-prod-db.sql
--
-- Or:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/sql/bootstrap-empty-prod-db.sql
--
-- Source of truth: backend/src/**/entities/*.ts
-- Schema files: backend/sql/schema/ (domain-grouped, no incremental migrations)

\set ON_ERROR_STOP on

BEGIN;

\ir schema/010_users_and_auth.sql
\ir schema/020_vault.sql
\ir schema/030_rwa_tokens.sql
\ir schema/040_marketplace.sql
\ir schema/045_p2p.sql
\ir schema/050_portfolio.sql
\ir schema/060_admin.sql
\ir schema/064_marketplace_partners.sql
\ir schema/065_bulk_mint.sql
\ir schema/070_cardhedger.sql
\ir schema/900_triggers.sql

COMMIT;

DO $$
BEGIN
  IF to_regclass('public.users') IS NULL
     OR to_regclass('public.marketplace_collections') IS NULL
     OR to_regclass('public.rwa_tokens') IS NULL
     OR to_regclass('public.collection_market_snapshots') IS NULL
     OR to_regclass('public.orders') IS NULL
     OR to_regclass('public.portfolio_daily_snapshots') IS NULL
     OR to_regclass('public.p2p_listings') IS NULL
     OR to_regclass('public.vault_assets') IS NULL
     OR to_regclass('public.marketplace_partners') IS NULL
     OR to_regclass('public.bulk_mint_jobs') IS NULL
     OR to_regclass('public.card_top100_daily_snapshots') IS NULL THEN
    RAISE EXCEPTION 'bootstrap incomplete — expected core tables missing';
  END IF;
END $$;
