-- Harden vault_redemptions integrity for redeem pay / custody / refund.
-- Safe to re-run. Apply after add_vault_redemptions_custody_refund.sql +
-- add_vault_redeem_payment_claims.sql.
--
-- psql … -f backend/sql/maintenance/harden_vault_redemptions_integrity.sql

-- Ensure every paid redemption hash has a claim row (FK prerequisite).
INSERT INTO vault_redeem_payment_claims (
  payment_tx_hash,
  payment_batch_id,
  payment_received_usdc_micros,
  chain_id
)
SELECT DISTINCT ON (lower(r.payment_tx_hash))
  lower(r.payment_tx_hash),
  r.payment_batch_id,
  r.payment_received_usdc_micros,
  r.chain_id
FROM vault_redemptions r
WHERE r.payment_tx_hash IS NOT NULL
  AND r.payment_batch_id IS NOT NULL
ORDER BY lower(r.payment_tx_hash), r.requested_at ASC
ON CONFLICT (payment_tx_hash) DO NOTHING;

-- Normalize hashes already written in mixed case.
UPDATE vault_redemptions
SET payment_tx_hash = lower(payment_tx_hash)
WHERE payment_tx_hash IS NOT NULL
  AND payment_tx_hash <> lower(payment_tx_hash);

-- Status CHECK must include in_custody + refunded (older DBs may lack them).
ALTER TABLE vault_redemptions
  DROP CONSTRAINT IF EXISTS vault_redemptions_status_check;

ALTER TABLE vault_redemptions
  ADD CONSTRAINT vault_redemptions_status_check CHECK (
    status IN (
      'pending',
      'ownership_verified',
      'in_custody',
      'burned',
      'vault_release_pending',
      'completed',
      'failed',
      'cancelled',
      'refunded'
    )
  );

ALTER TABLE vault_redemptions
  DROP CONSTRAINT IF EXISTS vault_redemptions_refund_status_check;

ALTER TABLE vault_redemptions
  ADD CONSTRAINT vault_redemptions_refund_status_check CHECK (
    refund_status IN (
      'none',
      'usdc_refunded',
      'nft_returned',
      'fully_refunded'
    )
  );

-- Paid redemption rows may reference the claims ledger (NULL payment_tx_hash stays unpaid).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_vault_redemptions_payment_claim'
  ) THEN
    ALTER TABLE vault_redemptions
      ADD CONSTRAINT fk_vault_redemptions_payment_claim
      FOREIGN KEY (payment_tx_hash)
      REFERENCES vault_redeem_payment_claims (payment_tx_hash)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vault_redemptions_status
  ON vault_redemptions (status);

COMMENT ON COLUMN vault_redemptions.payment_received_usdc_micros IS
  'Batch-total USDC micros actually received (copied onto every sibling row). Never SUM across a batch; use this value once or read vault_redeem_payment_claims.';

COMMENT ON COLUMN vault_redemptions.refunded_usdc_micros IS
  'Batch-total USDC micros refunded (copied onto every sibling row). Same grain as payment_received_usdc_micros — never SUM across a batch.';

COMMENT ON COLUMN vault_redemptions.ship_to_country IS
  'ISO-3166 alpha-2 destination stored at redeem time (not the fee bucket us|ca|intl).';

COMMENT ON TABLE vault_redeem_payment_claims IS
  'Ledger uniqueness: one USDC payment_tx_hash funds one payment_batch_id. Redemption rows denormalize these fields for ops joins.';
