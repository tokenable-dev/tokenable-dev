-- Unique redeem USDC payment claims (one payment_tx_hash → one payment_batch_id).
-- Needed because multi-card batches denormalize the same payment_tx_hash onto every
-- vault_redemptions row, so UNIQUE on that column alone would break multi-card batches.
--
-- Apply: psql $DATABASE_URL -f backend/sql/maintenance/add_vault_redeem_payment_claims.sql

CREATE TABLE IF NOT EXISTS vault_redeem_payment_claims (
  payment_tx_hash varchar(80) PRIMARY KEY,
  payment_batch_id uuid NOT NULL,
  payment_received_usdc_micros numeric(24, 0),
  chain_id integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_vault_redeem_payment_claims_batch
  ON vault_redeem_payment_claims (payment_batch_id);

COMMENT ON TABLE vault_redeem_payment_claims IS
  'Source of truth: each redeem USDC payment_tx_hash funds exactly one payment_batch_id.';

-- Backfill from existing paid redemptions (one row per payment_tx_hash).
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
