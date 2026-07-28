-- Wipe marketplace + vault transactional data for a fresh chain redeploy or site relaunch.
-- Does NOT delete users, admins, partners, or Cardhedger infra audit tables (top100, delta runs).
--
-- Run AFTER on-chain adminBurn for all live tokens (see backend/scripts/burn-all-rwa-tokens.mjs)
-- so the same PSA cert can be minted again.
--
-- Docker:
--   docker exec -i tokenable-postgres psql -U tokenable -d tokenable \
--     < backend/sql/maintenance/reset_marketplace_data.sql
-- Local:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/sql/maintenance/reset_marketplace_data.sql

BEGIN;

TRUNCATE TABLE marketplace_notifications RESTART IDENTITY CASCADE;
TRUNCATE TABLE p2p_orders RESTART IDENTITY CASCADE;
TRUNCATE TABLE p2p_listings RESTART IDENTITY CASCADE;
TRUNCATE TABLE bulk_mint_job_items RESTART IDENTITY CASCADE;
TRUNCATE TABLE bulk_mint_jobs RESTART IDENTITY CASCADE;
TRUNCATE TABLE portfolio_holdings RESTART IDENTITY CASCADE;
TRUNCATE TABLE orders RESTART IDENTITY CASCADE;
TRUNCATE TABLE rwa_tokens RESTART IDENTITY CASCADE;
TRUNCATE TABLE collection_market_snapshots RESTART IDENTITY CASCADE;
TRUNCATE TABLE cardhedger_price_subscriptions RESTART IDENTITY CASCADE;
TRUNCATE TABLE marketplace_collections RESTART IDENTITY CASCADE;
TRUNCATE TABLE user_watchlist RESTART IDENTITY CASCADE;
TRUNCATE TABLE portfolio_daily_snapshots RESTART IDENTITY CASCADE;
TRUNCATE TABLE vault_redemptions RESTART IDENTITY CASCADE;
TRUNCATE TABLE vault_submission_items RESTART IDENTITY CASCADE;
TRUNCATE TABLE vault_submissions RESTART IDENTITY CASCADE;
TRUNCATE TABLE vault_cycles RESTART IDENTITY CASCADE;
TRUNCATE TABLE vault_assets RESTART IDENTITY CASCADE;

-- Optional local PSA lookup cache (not in canonical schema bootstrap).
DO $$
BEGIN
  IF to_regclass('public.psa_cert_snapshots') IS NOT NULL THEN
    TRUNCATE TABLE psa_cert_snapshots;
  END IF;
END $$;

COMMIT;
