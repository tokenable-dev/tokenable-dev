-- Existing DBs: create partner bulk mint+list tables (safe to re-run for empty DBs).
-- Requires marketplace_partners first:
--   docker exec -i tokenable-postgres psql -U tokenable -d tokenable \
--     < backend/sql/maintenance/add_marketplace_partners.sql
-- Then:
--   docker exec -i tokenable-postgres psql -U tokenable -d tokenable \
--     < backend/sql/maintenance/add_bulk_mint_tables.sql
--
-- If you already have the old custody/intended_recipient bulk mint tables, use
-- migrate_bulk_mint_to_partner_list.sql instead.

CREATE TABLE IF NOT EXISTS bulk_mint_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status varchar(32) NOT NULL,
  partner_id uuid NOT NULL REFERENCES marketplace_partners(id),
  chain_id int NOT NULL,
  item_count int NOT NULL DEFAULT 0,
  prepared_count int NOT NULL DEFAULT 0,
  minted_count int NOT NULL DEFAULT 0,
  listed_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bulk_mint_jobs_status_check
    CHECK (status IN (
      'pending',
      'preparing',
      'ready_to_commit',
      'committing',
      'completed',
      'failed'
    ))
);

CREATE TABLE IF NOT EXISTS bulk_mint_job_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES bulk_mint_jobs(id) ON DELETE CASCADE,
  cert_number varchar(32) NOT NULL,
  list_price_usdc varchar(32) NOT NULL,
  status varchar(32) NOT NULL,
  token_uri text,
  vault_ref varchar(66),
  token_id varchar(32),
  tx_hash varchar(66),
  order_hash varchar(66),
  vault_cycle_id uuid,
  error_message text,
  sort_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bulk_mint_job_items_status_check
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
    ))
);

CREATE INDEX IF NOT EXISTS idx_bulk_mint_job_items_job_id
  ON bulk_mint_job_items (job_id);

CREATE INDEX IF NOT EXISTS idx_bulk_mint_job_items_cert
  ON bulk_mint_job_items (cert_number);

CREATE INDEX IF NOT EXISTS idx_bulk_mint_jobs_partner_id
  ON bulk_mint_jobs (partner_id);

CREATE INDEX IF NOT EXISTS idx_bulk_mint_job_items_order_hash
  ON bulk_mint_job_items (order_hash);
