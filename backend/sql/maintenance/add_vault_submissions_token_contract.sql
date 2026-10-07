-- Stamp sell-flow packages with the RWA they were created for.
-- Linked cycles are backfilled from rwa_tokens. Unstamped rows (no mint yet,
-- or wiped before this column existed) stay NULL and are hidden from the
-- active contract's sell / vault lists.

ALTER TABLE vault_submissions
  ADD COLUMN IF NOT EXISTS chain_id integer;

ALTER TABLE vault_submissions
  ADD COLUMN IF NOT EXISTS token_contract varchar(42);

COMMENT ON COLUMN vault_submissions.token_contract IS
  'RWA address this package was created for. Lists only return the address configured for the request chain.';

CREATE INDEX IF NOT EXISTS idx_vault_submissions_token_contract
  ON vault_submissions (lower(token_contract))
  WHERE token_contract IS NOT NULL;

UPDATE vault_submissions s
SET token_contract = sub.addr,
    chain_id = COALESCE(s.chain_id, sub.chain_id)
FROM (
  SELECT i.submission_id,
         min(lower(t.token_contract)) AS addr,
         min(c.chain_id) AS chain_id
  FROM vault_submission_items i
  JOIN vault_cycles c ON c.id = i.vault_cycle_id
  JOIN rwa_tokens t ON t.vault_cycle_id = c.id
  WHERE t.token_contract IS NOT NULL
  GROUP BY i.submission_id
) sub
WHERE s.id = sub.submission_id
  AND s.token_contract IS NULL;
