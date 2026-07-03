-- Purge legacy Sepolia-era marketplace data and reset catalog for Amoy / Polygon.
-- Safe to re-run on dev when switching networks or redeploying RWA contracts.
--
-- Docker:
--   docker exec -i tokenable-postgres psql -U tokenable -d tokenable < backend/sql/maintenance/077_reset_amoy_marketplace_data.sql
-- Local:
--   psql "postgresql://tokenable:tokenable@localhost:5432/tokenable" -f backend/sql/maintenance/077_reset_amoy_marketplace_data.sql

BEGIN;

-- On-chain marketplace rows (orders keyed by token_contract / chain)
TRUNCATE TABLE portfolio_hidden_holdings RESTART IDENTITY CASCADE;
TRUNCATE TABLE orders RESTART IDENTITY CASCADE;
TRUNCATE TABLE rwa_tokens RESTART IDENTITY CASCADE;

-- Catalog + pricing snapshots (chain-agnostic metadata from Sepolia dev)
TRUNCATE TABLE collection_market_snapshots RESTART IDENTITY CASCADE;
TRUNCATE TABLE marketplace_collections RESTART IDENTITY CASCADE;
TRUNCATE TABLE user_watchlist RESTART IDENTITY CASCADE;

-- Portfolio analytics tied to old wallet/token rows
TRUNCATE TABLE portfolio_daily_snapshots RESTART IDENTITY CASCADE;

-- Vault lifecycle (Amoy redeploy / fresh start)
TRUNCATE TABLE vault_redemptions RESTART IDENTITY CASCADE;
TRUNCATE TABLE vault_cycles RESTART IDENTITY CASCADE;
TRUNCATE TABLE vault_assets RESTART IDENTITY CASCADE;

COMMIT;

COMMENT ON TABLE marketplace_collections IS
  'Logical collection bucket. Cleared with 077 after Sepolia → Amoy/Polygon migration.';
COMMENT ON TABLE rwa_tokens IS
  'On-chain mint registry (contract + tokenId). Scoped per chain via token_contract.';
