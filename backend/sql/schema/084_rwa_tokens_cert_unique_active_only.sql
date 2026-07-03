-- Replace the blanket (contract, cert_number) unique constraint with one that
-- only applies to *live* (not-yet-burned) tokens.
--
-- Background: migration 078 created uq_rwa_tokens_contract_cert_number which
-- prevented the same PSA cert from ever appearing twice in rwa_tokens, even
-- after the NFT was burned during a vault redemption. That blocked legitimate
-- re-vaulting of the same physical card in a subsequent vault cycle.
--
-- New rule: at most one *active* (burned_at IS NULL) token per (contract, cert).
-- Burned tokens are kept as historical records and are not subject to the constraint.

DROP INDEX IF EXISTS uq_rwa_tokens_contract_cert_number;

CREATE UNIQUE INDEX IF NOT EXISTS uq_rwa_tokens_contract_cert_active
  ON rwa_tokens (token_contract, cert_number)
  WHERE cert_number IS NOT NULL
    AND burned_at IS NULL;
