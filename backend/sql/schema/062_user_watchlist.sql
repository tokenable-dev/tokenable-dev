-- user_watchlist — per-account saved markets collections
-- Entity: backend/src/marketplace/entities/user-watchlist.entity.ts

CREATE TABLE IF NOT EXISTS user_watchlist (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  collection_key varchar(128) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_watchlist_user_collection_unique UNIQUE (user_id, collection_key)
);

CREATE INDEX IF NOT EXISTS idx_user_watchlist_user_created
  ON user_watchlist (user_id, created_at DESC);

COMMENT ON TABLE user_watchlist IS
  'Authenticated user saved marketplace collections (watchlist).';
