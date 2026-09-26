-- Auto-confirm audit on PSA Items Received arrival reviews
ALTER TABLE vault_psa_arrival_reviews
  ADD COLUMN IF NOT EXISTS confirmed_via varchar(16),
  ADD COLUMN IF NOT EXISTS skipped_public_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE vault_psa_arrival_reviews
  DROP CONSTRAINT IF EXISTS vault_psa_arrival_reviews_confirmed_via_check;

ALTER TABLE vault_psa_arrival_reviews
  ADD CONSTRAINT vault_psa_arrival_reviews_confirmed_via_check CHECK (
    confirmed_via IS NULL OR confirmed_via IN ('auto', 'admin')
  );

COMMENT ON COLUMN vault_psa_arrival_reviews.confirmed_via IS
  'How Ship→PSA was applied: auto (Gmail poll) or admin (manual Confirm).';
COMMENT ON COLUMN vault_psa_arrival_reviews.skipped_public_ids IS
  'Packages that failed adminMarkArrived at confirm time (audit).';
