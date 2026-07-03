-- Linked authentication providers per platform user (Privy, Google, email OTP, wallet, etc.)
-- Entity: backend/src/user/entities/user-auth-provider.entity.ts

CREATE TABLE IF NOT EXISTS user_auth_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_type varchar(32) NOT NULL,
  provider_subject varchar(256) NOT NULL,
  provider_account_id varchar(128) NULL,
  email varchar(320) NULL,
  phone varchar(32) NULL,
  display_name varchar(200) NULL,
  avatar_url text NULL,
  is_verified boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  linked_at timestamptz NOT NULL DEFAULT now(),
  unlinked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_auth_providers_user_id
  ON user_auth_providers (user_id);

CREATE INDEX IF NOT EXISTS idx_user_auth_providers_email
  ON user_auth_providers (lower(email))
  WHERE email IS NOT NULL;

-- Dedupe before partial unique index (safe if synchronize created duplicates)
DELETE FROM user_auth_providers a
USING user_auth_providers b
WHERE a.id > b.id
  AND a.provider_type = b.provider_type
  AND lower(a.provider_subject) = lower(b.provider_subject)
  AND a.unlinked_at IS NULL
  AND b.unlinked_at IS NULL;

DROP INDEX IF EXISTS user_auth_providers_active_unique;

CREATE UNIQUE INDEX IF NOT EXISTS user_auth_providers_active_unique
  ON user_auth_providers (provider_type, provider_subject)
  WHERE unlinked_at IS NULL;

COMMENT ON TABLE user_auth_providers IS
  'Normalized linked login methods (email, OAuth, wallet, passkey) for a platform user.';

-- Backfill from legacy columns where possible
INSERT INTO user_auth_providers (
  user_id, provider_type, provider_subject, email, display_name, avatar_url, is_verified, metadata
)
SELECT
  u.id,
  'privy',
  u.privy_id,
  u.email,
  u.name,
  u.picture_url,
  u.email_verified,
  jsonb_build_object('source', 'migration', 'privy_id', u.privy_id)
FROM users u
WHERE u.privy_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_auth_providers p
    WHERE p.provider_type = 'privy'
      AND p.provider_subject = u.privy_id
      AND p.unlinked_at IS NULL
  );

INSERT INTO user_auth_providers (
  user_id, provider_type, provider_subject, email, display_name, avatar_url, is_verified, metadata
)
SELECT
  u.id,
  'google_oauth',
  u.google_id,
  u.email,
  u.name,
  u.picture_url,
  u.email_verified,
  jsonb_build_object('source', 'migration', 'google_id', u.google_id)
FROM users u
WHERE u.google_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_auth_providers p
    WHERE p.provider_type = 'google_oauth'
      AND p.provider_subject = u.google_id
      AND p.unlinked_at IS NULL
  );

INSERT INTO user_auth_providers (
  user_id, provider_type, provider_subject, email, display_name, is_verified, metadata
)
SELECT
  u.id,
  'email_password',
  lower(u.email),
  u.email,
  u.name,
  u.email_verified,
  jsonb_build_object('source', 'migration', 'has_password', true)
FROM users u
WHERE u.password_hash IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_auth_providers p
    WHERE p.provider_type = 'email_password'
      AND p.provider_subject = lower(u.email)
      AND p.unlinked_at IS NULL
  );

-- Backfill wallet auth providers from linked wallets (pre-refactor accounts)
INSERT INTO user_auth_providers (
  user_id, provider_type, provider_subject, is_verified, metadata
)
SELECT
  w.user_id,
  'wallet',
  lower(w.wallet_address),
  true,
  jsonb_build_object('source', 'wallet_backfill', 'wallet_kind', w.wallet_kind)
FROM user_wallets w
WHERE NOT EXISTS (
  SELECT 1 FROM user_auth_providers p
  WHERE p.user_id = w.user_id
    AND p.provider_type = 'wallet'
    AND lower(p.provider_subject) = lower(w.wallet_address)
    AND p.unlinked_at IS NULL
);
