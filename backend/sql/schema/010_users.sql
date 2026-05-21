-- users — Web2 (Google) accounts + optional wallet link
-- Entity: backend/src/user/entities/user.entity.ts

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(320) NOT NULL,
  google_id varchar(64),
  name varchar(200),
  picture_url text,
  email_verified boolean NOT NULL DEFAULT false,
  platform_email_verified_at timestamptz,
  email_verification_token_hash varchar(64),
  email_verification_expires_at timestamptz,
  verification_email_last_sent_at timestamptz,
  wallet_address varchar(42),
  wallet_linked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_google_id_unique UNIQUE (google_id),
  CONSTRAINT users_wallet_address_unique UNIQUE (wallet_address)
);

COMMENT ON TABLE users IS 'Platform accounts (Google OAuth) with optional linked wallet.';
COMMENT ON COLUMN users.wallet_address IS 'Checksummed 0x address; NULL allowed, unique when set.';
