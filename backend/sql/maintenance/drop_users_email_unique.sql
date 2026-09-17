-- Allow the same contact email on multiple wallet-only accounts.
-- Fresh installs already drop this in schema/010_users_and_auth.sql.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_unique;

-- Some DBs may have a unique index instead of a named constraint.
DROP INDEX IF EXISTS users_email_unique;
DROP INDEX IF EXISTS "UQ_97672ac88f789774dd47f7c8be3";

CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));

COMMENT ON COLUMN users.email IS
  'Contact inbox (or @privy.wallet placeholder for MetaMask-only until set). Not globally unique.';
