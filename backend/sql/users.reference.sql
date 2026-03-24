-- Reference DDL for `users` (TypeORM synchronize also creates this in dev).
-- Production: use migrations; add indexes as needed for analytics.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(320) NOT NULL UNIQUE,
  google_id VARCHAR(64) UNIQUE,
  name VARCHAR(200),
  picture_url TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  platform_email_verified_at TIMESTAMPTZ,
  email_verification_token_hash VARCHAR(64),
  email_verification_expires_at TIMESTAMPTZ,
  verification_email_last_sent_at TIMESTAMPTZ,
  wallet_address VARCHAR(42) UNIQUE,
  wallet_linked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Future: refresh_tokens(user_id, token_hash, expires_at)
-- Future: orders.buyer_user_id → users(id)
-- Future: provider ENUM('google','apple',...) if multi-provider
