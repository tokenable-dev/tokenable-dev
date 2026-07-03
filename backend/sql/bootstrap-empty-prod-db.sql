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
\ir schema/069_users_privy_kyc.sql
\ir schema/070_cardhedger_price_infra.sql
\ir schema/071_cardhedger_price_delta_import_runs.sql
\ir schema/072_cardhedger_delta_catalog_fallback.sql
\ir schema/074_user_auth_providers.sql
\ir schema/075_user_wallets_metadata.sql
\ir schema/076_user_kyc_platform.sql
\ir schema/073_perf_indexes.sql
\ir schema/078_rwa_tokens_cert_unique.sql
\ir schema/079_portfolio_hidden_holdings_chain_scope.sql
\ir schema/080_vault_assets.sql
\ir schema/081_vault_cycles.sql
\ir schema/082_vault_redemptions.sql
\ir schema/083_rwa_tokens_vault_lifecycle.sql
\ir schema/084_rwa_tokens_cert_unique_active_only.sql
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
