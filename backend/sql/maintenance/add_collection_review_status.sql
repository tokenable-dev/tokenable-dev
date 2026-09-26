-- Existing DBs: add collection review gate (safe to re-run).
ALTER TABLE marketplace_collections
  ADD COLUMN IF NOT EXISTS review_status varchar(32) NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'marketplace_collections_review_status_check'
  ) THEN
    ALTER TABLE marketplace_collections
      ADD CONSTRAINT marketplace_collections_review_status_check
      CHECK (review_status IN ('pending_review', 'active', 'rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_marketplace_collections_review_status
  ON marketplace_collections (review_status);

COMMENT ON COLUMN marketplace_collections.review_status IS
  'pending_review | active | rejected. New inserts are pending_review; Markets lists active only.';
