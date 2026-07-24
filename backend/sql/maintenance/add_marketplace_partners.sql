-- Existing DBs: create marketplace_partners (safe to re-run).
-- Docker:
--   docker exec -i tokenable-postgres psql -U tokenable -d tokenable \
--     < backend/sql/maintenance/add_marketplace_partners.sql

CREATE TABLE IF NOT EXISTS marketplace_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name varchar(128) NOT NULL,
  wallet_address varchar(42) NOT NULL,
  encrypted_private_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_partners_wallet_unique UNIQUE (wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_partners_active
  ON marketplace_partners (is_active);
