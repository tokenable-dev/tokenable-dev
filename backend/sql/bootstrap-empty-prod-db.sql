-- Tokenable — canonical PostgreSQL schema (entity-aligned, idempotent).
--
-- Fresh database bootstrap (Docker example):
--   docker exec -i tokenable-postgres psql -U tokenable -d tokenable \
--     -v ON_ERROR_STOP=1 -f - < backend/sql/bootstrap-empty-prod-db.sql
--
-- Or from repo root with psql client:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/sql/bootstrap-empty-prod-db.sql
--
-- Source of truth: backend/src/**/entities/*.ts
-- Modular files live under backend/sql/schema/ (same content, easier review).

\set ON_ERROR_STOP on

BEGIN;

\ir schema/010_users.sql
\ir schema/015_psa_cert_snapshots.sql
\ir schema/020_marketplace_collections.sql
\ir schema/025_rwa_tokens.sql
\ir schema/026_rwa_tokens_display_image.sql
\ir schema/030_collection_market_snapshots.sql
\ir schema/040_orders.sql
\ir schema/050_refactor_legacy_columns.sql
\ir schema/060_portfolio_daily_snapshots.sql
\ir schema/061_portfolio_hidden_holdings.sql
\ir schema/062_user_watchlist.sql
\ir schema/063_users_password_hash.sql
\ir schema/064_verification_tokens.sql
\ir schema/065_user_wallets.sql
\ir schema/066_user_wallets_allow_shared.sql
\ir schema/067_password_reset_tokens.sql
\ir schema/068_marketplace_admins.sql
\ir schema/900_triggers.sql

COMMIT;

-- Sanity check (non-fatal)
DO $$
BEGIN
  IF to_regclass('public.users') IS NULL
     OR to_regclass('public.psa_cert_snapshots') IS NULL
     OR to_regclass('public.marketplace_collections') IS NULL
     OR to_regclass('public.rwa_tokens') IS NULL
     OR to_regclass('public.collection_market_snapshots') IS NULL
     OR to_regclass('public.orders') IS NULL
     OR to_regclass('public.portfolio_daily_snapshots') IS NULL THEN
    RAISE EXCEPTION 'bootstrap incomplete — expected core tables missing';
  END IF;
END $$;
