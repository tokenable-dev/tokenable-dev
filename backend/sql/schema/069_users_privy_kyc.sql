-- Privy identity + KYC status (Phase 1 auth migration)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS privy_id VARCHAR(128) NULL,
  ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(16) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMPTZ NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_privy_id_unique
  ON users (privy_id)
  WHERE privy_id IS NOT NULL;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_kyc_status_check;

ALTER TABLE users
  ADD CONSTRAINT users_kyc_status_check
  CHECK (kyc_status IN ('none', 'pending', 'approved', 'rejected'));
