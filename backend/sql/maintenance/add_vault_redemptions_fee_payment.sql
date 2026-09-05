-- PSA Vault redeem fee snapshot + USDC payment proof on vault_redemptions.
-- Apply: psql "$DATABASE_URL" -f backend/sql/maintenance/add_vault_redemptions_fee_payment.sql

ALTER TABLE vault_redemptions
  ADD COLUMN IF NOT EXISTS fee_retrieval_usd numeric(12, 2),
  ADD COLUMN IF NOT EXISTS fee_early_withdrawal_usd numeric(12, 2),
  ADD COLUMN IF NOT EXISTS fee_shipping_usd numeric(12, 2),
  ADD COLUMN IF NOT EXISTS fee_total_usd numeric(12, 2),
  ADD COLUMN IF NOT EXISTS payment_tx_hash varchar(80),
  ADD COLUMN IF NOT EXISTS payment_batch_id uuid,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS vaulted_at timestamptz,
  ADD COLUMN IF NOT EXISTS early_withdrawal boolean;

COMMENT ON COLUMN vault_redemptions.fee_retrieval_usd IS
  'PSA retrieval fee charged for this card (snapshot at request time).';
COMMENT ON COLUMN vault_redemptions.fee_early_withdrawal_usd IS
  'PSA early-withdrawal surcharge if vaulted < N days (snapshot).';
COMMENT ON COLUMN vault_redemptions.fee_shipping_usd IS
  'Shipping fee share — full shipment shipping on the first card of a payment batch, 0 on siblings.';
COMMENT ON COLUMN vault_redemptions.fee_total_usd IS
  'retrieval + early + shipping share for this row.';
COMMENT ON COLUMN vault_redemptions.payment_tx_hash IS
  'USDC ERC-20 transfer tx to PLATFORM_FEE_RECIPIENT that paid this batch.';
COMMENT ON COLUMN vault_redemptions.payment_batch_id IS
  'Shared id for multi-card shipment paid in one USDC transfer.';
COMMENT ON COLUMN vault_redemptions.vaulted_at IS
  'Copied from vault_cycles.deposited_at used for early-withdrawal check.';
COMMENT ON COLUMN vault_redemptions.early_withdrawal IS
  'True when early-withdrawal fee applied at request time.';

CREATE INDEX IF NOT EXISTS idx_vault_redemptions_payment_tx
  ON vault_redemptions (payment_tx_hash)
  WHERE payment_tx_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vault_redemptions_payment_batch
  ON vault_redemptions (payment_batch_id)
  WHERE payment_batch_id IS NOT NULL;
