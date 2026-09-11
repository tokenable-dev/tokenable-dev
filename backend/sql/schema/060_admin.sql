-- Marketplace admin console credentials
-- Entity: backend/src/marketplace/entities/marketplace-admin.entity.ts

CREATE TABLE IF NOT EXISTS marketplace_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar(64) NOT NULL,
  password_hash varchar(255) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_admins_username_unique UNIQUE (username)
);

COMMENT ON TABLE marketplace_admins IS 'Marketplace admin console accounts (separate from users table).';
