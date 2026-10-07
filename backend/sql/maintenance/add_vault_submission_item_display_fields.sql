-- Per-cert SSOT display fields for vault hub / packing slip (sell-flow card identity).
-- Fresh bootstrap: columns are in schema/020_vault.sql.

ALTER TABLE vault_submission_items
  ADD COLUMN IF NOT EXISTS card_number varchar(64),
  ADD COLUMN IF NOT EXISTS card_year varchar(8),
  ADD COLUMN IF NOT EXISTS set_name varchar(256),
  ADD COLUMN IF NOT EXISTS language varchar(16),
  ADD COLUMN IF NOT EXISTS variant varchar(256);

COMMENT ON COLUMN vault_submission_items.card_number IS
  'SSOT card number from PSA analyze (sell-flow add-cards).';
COMMENT ON COLUMN vault_submission_items.card_year IS
  '4-digit year from PSA analyze.';
COMMENT ON COLUMN vault_submission_items.set_name IS
  'Expansion / set name from PSA analyze.';
