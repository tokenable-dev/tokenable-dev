-- Tracks Transfer-log backfill progress per RWA contract.

CREATE TABLE IF NOT EXISTS rwa_owner_index_cursors (
  token_contract varchar(42) NOT NULL PRIMARY KEY,
  last_scanned_block bigint NOT NULL DEFAULT 0,
  backfill_complete boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE rwa_owner_index_cursors IS
  'When backfill_complete is true, GET /blockchain/rwa/tokens/:address reads owner_wallet from rwa_tokens.';
