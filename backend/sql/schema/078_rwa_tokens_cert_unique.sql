-- Prevent duplicate on-chain mints of the same PSA cert on a given contract.
-- Primary defense is the pre-mint app-level check in RwaService.uploadToIpfs;
-- this index is the data-integrity backstop (fails the post-mint rwa_tokens
-- upsert loudly instead of silently allowing two tokenIds for one cert).

CREATE UNIQUE INDEX IF NOT EXISTS uq_rwa_tokens_contract_cert_number
  ON rwa_tokens (token_contract, cert_number)
  WHERE cert_number IS NOT NULL;
