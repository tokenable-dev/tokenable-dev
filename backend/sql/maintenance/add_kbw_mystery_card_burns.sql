-- Web2 KBW Mystery Card burn ledger (hide from Portfolio; not on-chain burn).
-- Scoped by email: one participation / burn per contact email across wallets.
-- Idempotent: recreates the table when still wallet-scoped or missing email.

DO $$
BEGIN
  IF to_regclass('public.kbw_mystery_card_burns') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'kbw_mystery_card_burns'
         AND column_name = 'email'
     ) THEN
    DROP TABLE kbw_mystery_card_burns;
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'kbw_mystery_card_burns'
      AND column_name = 'wallet_address'
  ) THEN
    DROP TABLE kbw_mystery_card_burns;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS kbw_mystery_card_burns (
  id serial PRIMARY KEY,
  email varchar(320) NOT NULL,
  burned_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kbw_mystery_card_burns_email_unique UNIQUE (email)
);

COMMENT ON TABLE kbw_mystery_card_burns IS
  'Web2 KBW Mystery Card burn ledger — one row per email; all wallets sharing that email hide the card after burn.';
