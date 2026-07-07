-- Users, wallets, auth providers, KYC audit, verification tokens
-- Entities: backend/src/user/entities/*.ts, backend/src/auth/entities/verification-token.entity.ts

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(320) NOT NULL,
  google_id varchar(64),
  password_hash varchar(255),
  name varchar(200),
  picture_url text,
  email_verified boolean NOT NULL DEFAULT false,
  wallet_address varchar(42),
  wallet_linked_at timestamptz,
  privy_id varchar(128),
  kyc_status varchar(16) NOT NULL DEFAULT 'none',
  kyc_verified_at timestamptz,
  kyc_provider varchar(32),
  kyc_external_id varchar(128),
  kyc_rejection_reason text,
  last_privy_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_google_id_unique UNIQUE (google_id),
  CONSTRAINT users_kyc_status_check
    CHECK (kyc_status IN ('none', 'pending', 'approved', 'rejected'))
);

CREATE UNIQUE INDEX IF NOT EXISTS users_privy_id_unique
  ON users (privy_id)
  WHERE privy_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_wallet_address
  ON users (wallet_address)
  WHERE wallet_address IS NOT NULL;

COMMENT ON TABLE users IS 'Platform accounts (Privy / Google / email) with optional linked wallet.';
COMMENT ON COLUMN users.password_hash IS 'scrypt hash for email/password login; NULL for OAuth-only accounts.';
COMMENT ON COLUMN users.wallet_address IS 'Primary linked wallet (denormalized). Same address may appear on multiple users.';

CREATE TABLE IF NOT EXISTS user_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address varchar(42) NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  chain_type varchar(16) NOT NULL DEFAULT 'ethereum',
  wallet_kind varchar(16) NOT NULL DEFAULT 'external',
  wallet_client varchar(32),
  connector_type varchar(32),
  source varchar(32) NOT NULL DEFAULT 'legacy',
  privy_wallet_id varchar(128),
  linked_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_wallets_user_address_unique UNIQUE (user_id, wallet_address),
  CONSTRAINT user_wallets_wallet_kind_check
    CHECK (wallet_kind IN ('embedded', 'external')),
  CONSTRAINT user_wallets_source_check
    CHECK (source IN ('privy_sync', 'admin', 'legacy'))
);

CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets (user_id);
CREATE INDEX IF NOT EXISTS idx_user_wallets_wallet_address ON user_wallets (wallet_address);

COMMENT ON TABLE user_wallets IS 'Wallets linked to a platform user (Privy sync or signature-verified).';
COMMENT ON COLUMN user_wallets.wallet_kind IS 'embedded = Privy embedded wallet; external = MetaMask, etc.';
COMMENT ON COLUMN user_wallets.source IS 'How the wallet was linked: privy_sync, admin override, or legacy.';

CREATE TABLE IF NOT EXISTS user_auth_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_type varchar(32) NOT NULL,
  provider_subject varchar(256) NOT NULL,
  provider_account_id varchar(128),
  email varchar(320),
  phone varchar(32),
  display_name varchar(200),
  avatar_url text,
  is_verified boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  linked_at timestamptz NOT NULL DEFAULT now(),
  unlinked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_auth_providers_user_id ON user_auth_providers (user_id);
CREATE INDEX IF NOT EXISTS idx_user_auth_providers_email
  ON user_auth_providers (lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_auth_providers_active_unique
  ON user_auth_providers (provider_type, provider_subject)
  WHERE unlinked_at IS NULL;

COMMENT ON TABLE user_auth_providers IS
  'Normalized linked login methods (email, OAuth, wallet, passkey) for a platform user.';

CREATE TABLE IF NOT EXISTS user_kyc_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status varchar(16) NOT NULL,
  provider varchar(32) NOT NULL DEFAULT 'privy',
  external_id varchar(128),
  reason text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_kyc_events_status_check
    CHECK (status IN ('none', 'pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_user_kyc_events_user_id
  ON user_kyc_events (user_id, created_at DESC);

COMMENT ON TABLE user_kyc_events IS 'Append-only KYC status transitions for audit and support.';

DO $$ BEGIN
  CREATE TYPE verification_token_type AS ENUM ('email_verify', 'password_reset');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL,
  type verification_token_type NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_tokens_token_hash ON verification_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_user_type_created
  ON verification_tokens (user_id, type, created_at DESC);

COMMENT ON TABLE verification_tokens IS
  'Hashed single-use verification tokens; raw token only sent by email.';
