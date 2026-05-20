-- Cardhedger headline snapshot columns on `marketplace_collections`.
-- Apply when production uses TYPEORM_SYNC=false (see MarketplaceCollection entity).

ALTER TABLE marketplace_collections
  ADD COLUMN IF NOT EXISTS cardhedger_resolved_card_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS cardhedger_headline_usd DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS cardhedger_spot_basis VARCHAR(32),
  ADD COLUMN IF NOT EXISTS cardhedger_pricing_synced_at TIMESTAMPTZ;
