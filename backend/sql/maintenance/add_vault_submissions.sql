-- Existing DBs: sell-flow submission tracking (pre-mint).
-- Fresh bootstrap already includes these tables via schema/020_vault.sql.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f backend/sql/maintenance/add_vault_submissions.sql

\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE IF NOT EXISTS vault_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id varchar(32) NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status varchar(32) NOT NULL DEFAULT 'draft',
  carrier varchar(32),
  tracking_number varchar(128),
  ship_date date,
  shipped_at timestamptz,
  packing_slip_downloaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vault_submissions_public_id_unique UNIQUE (public_id),
  CONSTRAINT vault_submissions_status_check CHECK (
    status IN (
      'draft',
      'awaiting_shipment',
      'in_transit',
      'psa_reviewing',
      'completed',
      'cancelled'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_vault_submissions_user_id ON vault_submissions (user_id);
CREATE INDEX IF NOT EXISTS idx_vault_submissions_user_status ON vault_submissions (user_id, status);

CREATE TABLE IF NOT EXISTS vault_submission_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES vault_submissions(id) ON DELETE CASCADE,
  cert_number varchar(32) NOT NULL,
  display_name varchar(512),
  grade varchar(32),
  image_url text,
  status varchar(24) NOT NULL DEFAULT 'draft',
  rejection_reason text,
  vault_cycle_id uuid REFERENCES vault_cycles(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vault_submission_items_submission_cert_unique UNIQUE (submission_id, cert_number),
  CONSTRAINT vault_submission_items_status_check CHECK (
    status IN (
      'draft',
      'confirmed',
      'in_transit',
      'reviewing',
      'approved',
      'rejected',
      'minting',
      'completed',
      'failed'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_vault_submission_items_submission_id
  ON vault_submission_items (submission_id);
CREATE INDEX IF NOT EXISTS idx_vault_submission_items_cert
  ON vault_submission_items (cert_number);
CREATE INDEX IF NOT EXISTS idx_vault_submission_items_cycle
  ON vault_submission_items (vault_cycle_id)
  WHERE vault_cycle_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_vault_submissions_updated_at ON vault_submissions;
CREATE TRIGGER trg_vault_submissions_updated_at
  BEFORE UPDATE ON vault_submissions
  FOR EACH ROW
  EXECUTE PROCEDURE tokenable_set_updated_at();

DROP TRIGGER IF EXISTS trg_vault_submission_items_updated_at ON vault_submission_items;
CREATE TRIGGER trg_vault_submission_items_updated_at
  BEFORE UPDATE ON vault_submission_items
  FOR EACH ROW
  EXECUTE PROCEDURE tokenable_set_updated_at();

COMMIT;
