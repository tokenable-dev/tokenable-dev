-- Track welcome email delivery (idempotent send on first Privy registration).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamptz;

COMMENT ON COLUMN users.welcome_email_sent_at IS
  'When the one-time welcome email was sent (NULL = not sent yet).';
