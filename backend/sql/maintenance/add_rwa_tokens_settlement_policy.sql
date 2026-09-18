-- Self-vault hold: Seaport asks send 100% USDC to platform; seller paid later off-protocol.
ALTER TABLE rwa_tokens
  ADD COLUMN IF NOT EXISTS settlement_policy varchar(32) NOT NULL DEFAULT 'standard';

COMMENT ON COLUMN rwa_tokens.settlement_policy IS
  'standard = Seaport seller+fee split; self_vault_hold = 100% platform take, delayed seller payout';
