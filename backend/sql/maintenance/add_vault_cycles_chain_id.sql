-- Existing DBs: scope vault_cycles by chain (safe to re-run).
--
-- The on-chain activeTokenIdByVaultRef invariant is per contract (= per
-- chain), so the "one open cycle per asset" DB rule must be per (asset,
-- chain) too — otherwise a cert minted on Sepolia blocks its Polygon mint.
--
-- TypeORM synchronize alone is NOT enough: the old partial unique index
-- uq_vault_cycles_one_open_per_asset must be replaced.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f backend/sql/maintenance/add_vault_cycles_chain_id.sql

ALTER TABLE vault_cycles
  ADD COLUMN IF NOT EXISTS chain_id integer;

-- Backfill from the minted NFT's chain when a P2P listing recorded it.
UPDATE vault_cycles c
SET chain_id = p.chain_id
FROM rwa_tokens t
JOIN p2p_listings p
  ON p.token_contract = t.token_contract AND p.token_id = t.token_id
WHERE t.vault_cycle_id = c.id
  AND c.chain_id IS NULL;

-- Remaining legacy rows: Sepolia (the only chain before Polygon launch).
UPDATE vault_cycles
SET chain_id = 11155111
WHERE chain_id IS NULL;

ALTER TABLE vault_cycles
  ALTER COLUMN chain_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vault_cycles_chain_id_positive'
  ) THEN
    ALTER TABLE vault_cycles
      ADD CONSTRAINT vault_cycles_chain_id_positive CHECK (chain_id > 0);
  END IF;
END $$;

DROP INDEX IF EXISTS uq_vault_cycles_one_open_per_asset;

CREATE UNIQUE INDEX IF NOT EXISTS uq_vault_cycles_one_open_per_asset_chain
  ON vault_cycles (vault_asset_id, chain_id)
  WHERE status NOT IN ('redeemed', 'cancelled');

COMMENT ON COLUMN vault_cycles.chain_id IS
  'EIP-155 chain id the cycle''s NFT is (or will be) minted on.';
COMMENT ON TABLE vault_cycles IS
  'One deposit→redeem lifecycle for a vault_asset on one chain. At most one open cycle per (asset, chain).';
