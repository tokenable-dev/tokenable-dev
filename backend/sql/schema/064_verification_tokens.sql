-- verification_tokens — single-use hashed tokens (email verify, etc.)
-- Entity: backend/src/auth/entities/verification-token.entity.ts

DO $$ BEGIN
  CREATE TYPE verification_token_type AS ENUM ('email_verify');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL,
  type verification_token_type NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_tokens_token_hash
  ON verification_tokens (token_hash);

CREATE INDEX IF NOT EXISTS idx_verification_tokens_user_type_created
  ON verification_tokens (user_id, type, created_at DESC);

COMMENT ON TABLE verification_tokens IS
  'Hashed single-use verification tokens; raw token only sent by email.';

-- Drop legacy per-user token columns (moved to verification_tokens)
ALTER TABLE users DROP COLUMN IF EXISTS email_verification_token_hash;
ALTER TABLE users DROP COLUMN IF EXISTS email_verification_expires_at;
ALTER TABLE users DROP COLUMN IF EXISTS verification_email_last_sent_at;
ALTER TABLE users DROP COLUMN IF EXISTS platform_email_verified_at;
