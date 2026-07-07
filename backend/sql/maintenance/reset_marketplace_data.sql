-- Wipe marketplace + vault transactional data for a fresh chain redeploy or site relaunch.
-- Does NOT delete users, admins, or Cardhedger infra audit tables.
--
-- Docker:
--   docker exec -i tokenable-postgres psql -U tokenable -d tokenable \
--     < backend/sql/maintenance/reset_marketplace_data.sql
-- Local:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/sql/maintenance/reset_marketplace_data.sql

BEGIN;

TRUNCATE TABLE portfolio_holdings RESTART IDENTITY CASCADE;
TRUNCATE TABLE orders RESTART IDENTITY CASCADE;
TRUNCATE TABLE rwa_tokens RESTART IDENTITY CASCADE;
TRUNCATE TABLE collection_market_snapshots RESTART IDENTITY CASCADE;
TRUNCATE TABLE marketplace_collections RESTART IDENTITY CASCADE;
TRUNCATE TABLE user_watchlist RESTART IDENTITY CASCADE;
TRUNCATE TABLE portfolio_daily_snapshots RESTART IDENTITY CASCADE;
TRUNCATE TABLE vault_redemptions RESTART IDENTITY CASCADE;
TRUNCATE TABLE vault_cycles RESTART IDENTITY CASCADE;
TRUNCATE TABLE vault_assets RESTART IDENTITY CASCADE;

COMMIT;
