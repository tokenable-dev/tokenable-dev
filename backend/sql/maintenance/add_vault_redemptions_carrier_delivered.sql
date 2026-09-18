-- FedEx Track → carrier delivery timestamp + how receipt was confirmed.
ALTER TABLE vault_redemptions
  ADD COLUMN IF NOT EXISTS carrier_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_confirmed_via varchar(16);

COMMENT ON COLUMN vault_redemptions.carrier_delivered_at IS
  'When carrier Track API reported Delivered (ACTUAL_DELIVERY / DL). Starts auto-receipt grace.';
COMMENT ON COLUMN vault_redemptions.receipt_confirmed_via IS
  'user = confirm-received tap; auto = grace cron after carrier_delivered_at.';

CREATE INDEX IF NOT EXISTS idx_vault_redemptions_carrier_delivered_pending
  ON vault_redemptions (carrier_delivered_at)
  WHERE tracking_number IS NOT NULL
    AND carrier_delivered_at IS NULL
    AND status IN ('in_custody', 'burned', 'vault_release_pending');
