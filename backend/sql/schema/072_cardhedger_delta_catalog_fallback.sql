-- Track delta-only vs catalog-wide snapshot refresh on import runs

ALTER TABLE cardhedger_price_delta_import_runs
  ADD COLUMN IF NOT EXISTS delta_matched_collection_count INT NOT NULL DEFAULT 0;

ALTER TABLE cardhedger_price_delta_import_runs
  ADD COLUMN IF NOT EXISTS catalog_fallback_count INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN cardhedger_price_delta_import_runs.delta_matched_collection_count IS
  'Collections matched from Cardhedger price-updates card_id → our catalog.';

COMMENT ON COLUMN cardhedger_price_delta_import_runs.catalog_fallback_count IS
  'Collections refreshed via catalog sync when delta feed had no catalog overlap (no client_id).';
