-- KYC metadata on users + audit trail for verification events (Phase 5 ready)
-- Entities: user.entity.ts, user-kyc-event.entity.ts

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS kyc_provider varchar(32) NULL,
  ADD COLUMN IF NOT EXISTS kyc_external_id varchar(128) NULL,
  ADD COLUMN IF NOT EXISTS kyc_rejection_reason text NULL,
  ADD COLUMN IF NOT EXISTS last_privy_sync_at timestamptz NULL;

CREATE TABLE IF NOT EXISTS user_kyc_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status varchar(16) NOT NULL,
  provider varchar(32) NOT NULL DEFAULT 'privy',
  external_id varchar(128) NULL,
  reason text NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_kyc_events
  DROP CONSTRAINT IF EXISTS user_kyc_events_status_check;

ALTER TABLE user_kyc_events
  ADD CONSTRAINT user_kyc_events_status_check
  CHECK (status IN ('none', 'pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_user_kyc_events_user_id
  ON user_kyc_events (user_id, created_at DESC);

COMMENT ON TABLE user_kyc_events IS 'Append-only KYC status transitions for audit and support.';
