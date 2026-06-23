-- users — Web2 (Google) accounts + optional wallet link
-- Entity: backend/src/user/entities/user.entity.ts

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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_google_id_unique UNIQUE (google_id),
  CONSTRAINT users_wallet_address_unique UNIQUE (wallet_address)
);

COMMENT ON TABLE users IS 'Platform accounts (Google OAuth and/or email/password) with optional linked wallet.';
COMMENT ON COLUMN users.password_hash IS 'scrypt hash for email/password login; NULL for Google-only accounts.';
COMMENT ON COLUMN users.wallet_address IS 'Checksummed 0x address; NULL allowed, unique when set.';
