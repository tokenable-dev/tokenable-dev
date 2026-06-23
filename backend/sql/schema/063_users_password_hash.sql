-- users.password_hash — email/password sign-in (nullable; Google-only users have NULL)
-- Entity: backend/src/user/entities/user.entity.ts

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash varchar(255);

COMMENT ON COLUMN users.password_hash IS
  'scrypt hash for email/password login; NULL for Google-only accounts.';
