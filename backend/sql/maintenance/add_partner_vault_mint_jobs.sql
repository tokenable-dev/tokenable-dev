-- Partner self-vault bulk mint (sell flow) — server-side job queue.
-- Safe to re-run (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS partner_vault_mint_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chain_id int NOT NULL,
  recipient_address varchar(42) NOT NULL,
  partner_id uuid NULL REFERENCES marketplace_partners(id) ON DELETE SET NULL,
  status varchar(32) NOT NULL DEFAULT 'pending',
  item_count int NOT NULL DEFAULT 0,
  processed_count int NOT NULL DEFAULT 0,
  succeeded_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_vault_mint_jobs_user_id
  ON partner_vault_mint_jobs (user_id);

CREATE TABLE IF NOT EXISTS partner_vault_mint_job_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES partner_vault_mint_jobs(id) ON DELETE CASCADE,
  sort_index int NOT NULL DEFAULT 0,
  cert_number varchar(32) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'pending',
  display_name varchar(512) NULL,
  token_id varchar(32) NULL,
  tx_hash varchar(66) NULL,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_vault_mint_job_items_job_id
  ON partner_vault_mint_job_items (job_id);
