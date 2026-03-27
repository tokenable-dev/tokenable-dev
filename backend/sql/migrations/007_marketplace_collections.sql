-- graded 메타 기준 컬렉션 — 첫 ask 리스팅 시 행 생성
-- psql -f 007_marketplace_collections.sql

CREATE TABLE IF NOT EXISTS marketplace_collections (
  collection_key VARCHAR(64) PRIMARY KEY,
  display_label TEXT NOT NULL,
  query_used TEXT NULL,
  components JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_collections_created
  ON marketplace_collections (created_at DESC);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS collection_key VARCHAR(64) NULL;

CREATE INDEX IF NOT EXISTS idx_orders_collection_key_active_ask
  ON orders (collection_key)
  WHERE collection_key IS NOT NULL AND status = 'active' AND side = 'ask';
