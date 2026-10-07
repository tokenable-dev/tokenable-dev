-- Migrate bulk mint jobs from custody/intended_recipient → partner mint+list.
-- Prerequisites: marketplace_partners exists (add_marketplace_partners.sql).
--
-- Jobs that still have intended_recipient and no partner_id are DELETED (cannot
-- map without a partner). Items without a price get placeholder '0' then fail
-- list until recreated — prefer empty/dev DBs.
--
-- Docker:
--   docker exec -i tokenable-postgres psql -U tokenable -d tokenable \
--     < backend/sql/maintenance/migrate_bulk_mint_to_partner_list.sql

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

ALTER TABLE bulk_mint_jobs
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES marketplace_partners(id);

ALTER TABLE bulk_mint_jobs
  ADD COLUMN IF NOT EXISTS listed_count int NOT NULL DEFAULT 0;

-- Unmigratable legacy jobs (no partner) — drop so NOT NULL can apply
DELETE FROM bulk_mint_jobs WHERE partner_id IS NULL;

ALTER TABLE bulk_mint_jobs
  ALTER COLUMN partner_id SET NOT NULL;

ALTER TABLE bulk_mint_jobs
  DROP COLUMN IF EXISTS intended_recipient;

ALTER TABLE bulk_mint_job_items
  ADD COLUMN IF NOT EXISTS list_price_usdc varchar(32);

ALTER TABLE bulk_mint_job_items
  ADD COLUMN IF NOT EXISTS order_hash varchar(66);

UPDATE bulk_mint_job_items
  SET list_price_usdc = '0'
  WHERE list_price_usdc IS NULL;

ALTER TABLE bulk_mint_job_items
  ALTER COLUMN list_price_usdc SET NOT NULL;

ALTER TABLE bulk_mint_job_items
  DROP CONSTRAINT IF EXISTS bulk_mint_job_items_status_check;

ALTER TABLE bulk_mint_job_items
  ADD CONSTRAINT bulk_mint_job_items_status_check
  CHECK (status IN (
    'pending',
    'preparing',
    'ready',
    'minting',
    'minted',
    'listed',
    'prepare_failed',
    'mint_failed',
    'list_failed',
    'skipped'
  ));

CREATE INDEX IF NOT EXISTS idx_bulk_mint_jobs_partner_id
  ON bulk_mint_jobs (partner_id);

CREATE INDEX IF NOT EXISTS idx_bulk_mint_job_items_order_hash
  ON bulk_mint_job_items (order_hash);
