-- Allow the same contact email on multiple wallet / social accounts.
-- Fresh installs already drop this in schema/010_users_and_auth.sql.
-- Idempotent: drops ANY unique constraint or unique index on users.email.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_unique;
DROP INDEX IF EXISTS users_email_unique;
DROP INDEX IF EXISTS "UQ_97672ac88f789774dd47f7c8be3";

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname AS name
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'users'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%(email)%'
  LOOP
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT IF EXISTS %I', r.name);
  END LOOP;

  FOR r IN
    SELECT i.relname AS name
    FROM pg_index x
    JOIN pg_class i ON i.oid = x.indexrelid
    JOIN pg_class t ON t.oid = x.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (x.indkey)
    WHERE n.nspname = 'public'
      AND t.relname = 'users'
      AND x.indisunique
      AND NOT x.indisprimary
      AND a.attname = 'email'
      AND array_length(x.indkey, 1) = 1
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I', r.name);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));

COMMENT ON COLUMN users.email IS
  'Contact inbox (or @privy.wallet placeholder for MetaMask-only until set). Not globally unique.';
