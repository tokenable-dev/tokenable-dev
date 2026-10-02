-- Redeem custody intake + exact payment recording + refund / tracking / memo
-- Apply: psql $DATABASE_URL -f backend/sql/maintenance/add_vault_redemptions_custody_refund.sql

ALTER TABLE vault_redemptions
  ADD COLUMN IF NOT EXISTS chain_id integer,

  -- Exact USDC micros that arrived in PLATFORM_FEE_RECIPIENT for this payment_batch
  -- (same value on every row of the batch). Canonical refund amount — never recompute.
  ADD COLUMN IF NOT EXISTS payment_received_usdc_micros numeric(24, 0),

  ADD COLUMN IF NOT EXISTS custody_tx_hash varchar(80),
  ADD COLUMN IF NOT EXISTS custody_at timestamptz,
  ADD COLUMN IF NOT EXISTS custody_return_tx_hash varchar(80),
  ADD COLUMN IF NOT EXISTS custody_returned_at timestamptz,

  ADD COLUMN IF NOT EXISTS refund_status varchar(24) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS refund_tx_hash varchar(80),
  ADD COLUMN IF NOT EXISTS refunded_usdc_micros numeric(24, 0),
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,

  ADD COLUMN IF NOT EXISTS tracking_number varchar(128),
  ADD COLUMN IF NOT EXISTS tracking_carrier varchar(64),
  ADD COLUMN IF NOT EXISTS tracking_set_at timestamptz,

  ADD COLUMN IF NOT EXISTS admin_memo text;

COMMENT ON COLUMN vault_redemptions.payment_received_usdc_micros IS
  'Batch-total USDC micros actually received (copied onto every sibling row). Never SUM across a batch; use once or read vault_redeem_payment_claims.';
COMMENT ON COLUMN vault_redemptions.custody_tx_hash IS
  'User-signed ERC-721 transfer into RWA_CUSTODY_WALLET_ADDRESS.';
COMMENT ON COLUMN vault_redemptions.refund_status IS
  'none | usdc_refunded | nft_returned | fully_refunded';
COMMENT ON COLUMN vault_redemptions.tracking_number IS
  'When set, refunds are blocked.';

-- Status values now include: in_custody, refunded (varchar already)
CREATE INDEX IF NOT EXISTS idx_vault_redemptions_payment_batch
  ON vault_redemptions (payment_batch_id)
  WHERE payment_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vault_redemptions_status
  ON vault_redemptions (status);
