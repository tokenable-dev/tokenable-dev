-- Wipe marketplace + vault transactional data for a fresh chain redeploy or site relaunch.
-- Does NOT delete users, admins, partners, or Cardhedger infra audit tables (top100, delta runs).
--
-- Run AFTER on-chain adminBurn for all live tokens on the *old* contract if you will
-- re-mint the same PSA certs while that contract is still the active RWA address
-- (see backend/scripts/burn-all-rwa-tokens.mjs). A brand-new empty contract does not
-- need burns — DB wipe is enough for vault/cert uniqueness.
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
TRUNCATE TABLE self_vault_settlements RESTART IDENTITY CASCADE;
TRUNCATE TABLE rwa_tokens RESTART IDENTITY CASCADE;
TRUNCATE TABLE rwa_owner_index_cursors RESTART IDENTITY CASCADE;
TRUNCATE TABLE collection_market_snapshots RESTART IDENTITY CASCADE;
TRUNCATE TABLE cardhedger_price_subscriptions RESTART IDENTITY CASCADE;
TRUNCATE TABLE marketplace_collections RESTART IDENTITY CASCADE;
TRUNCATE TABLE user_watchlist RESTART IDENTITY CASCADE;
TRUNCATE TABLE user_buyer_listing_alert RESTART IDENTITY CASCADE;
TRUNCATE TABLE portfolio_daily_snapshots RESTART IDENTITY CASCADE;
-- Redemptions reference payment claims (ON DELETE RESTRICT) — clear children first.
TRUNCATE TABLE vault_redemptions RESTART IDENTITY CASCADE;
TRUNCATE TABLE vault_redeem_payment_claims RESTART IDENTITY CASCADE;
TRUNCATE TABLE vault_submission_items RESTART IDENTITY CASCADE;
TRUNCATE TABLE vault_submissions RESTART IDENTITY CASCADE;
TRUNCATE TABLE vault_cycles RESTART IDENTITY CASCADE;
TRUNCATE TABLE vault_assets RESTART IDENTITY CASCADE;

-- Optional tables (may be absent on older local DBs).
DO $$
BEGIN
  IF to_regclass('public.psa_cert_snapshots') IS NOT NULL THEN
    TRUNCATE TABLE psa_cert_snapshots;
  END IF;
  IF to_regclass('public.vault_psa_arrival_reviews') IS NOT NULL THEN
    TRUNCATE TABLE vault_psa_arrival_reviews RESTART IDENTITY CASCADE;
  END IF;
  IF to_regclass('public.vault_psa_vaulted_reviews') IS NOT NULL THEN
    TRUNCATE TABLE vault_psa_vaulted_reviews RESTART IDENTITY CASCADE;
  END IF;
END $$;

COMMIT;
