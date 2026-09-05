-- Self-vault hold settlements: Seaport took 100% USDC to platform; seller paid later.
-- Entity: backend/src/marketplace/entities/self-vault-settlement.entity.ts

CREATE TABLE IF NOT EXISTS self_vault_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_hash varchar(80) NOT NULL,
  token_contract varchar(42) NOT NULL,
  token_id varchar(64) NOT NULL,
  seller_wallet varchar(42) NOT NULL,
  buyer_wallet varchar(42) NOT NULL,
  gross_usdc varchar(78) NOT NULL,
  seller_payout_usdc varchar(78) NOT NULL,
  chain_id integer NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'pending_confirm',
  fulfill_tx_hash varchar(80),
  payout_tx_hash varchar(80),
  confirmed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_self_vault_settlements_order_hash UNIQUE (order_hash)
);

CREATE INDEX IF NOT EXISTS idx_self_vault_settlements_seller
  ON self_vault_settlements (seller_wallet);

CREATE INDEX IF NOT EXISTS idx_self_vault_settlements_buyer
  ON self_vault_settlements (buyer_wallet);

CREATE INDEX IF NOT EXISTS idx_self_vault_settlements_status
  ON self_vault_settlements (status);

COMMENT ON TABLE self_vault_settlements IS
  'Ledger for self_vault_hold Seaport fills: company holds USDC until confirm/ops payout.';
