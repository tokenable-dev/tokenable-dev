-- Cancel legacy sell-flow draft packages (pre-ship is localStorage-only now).
-- Safe: only rows still status=draft with no tracking / ship recorded.
-- Idempotent — re-run is a no-op once drafts are cancelled.
--
-- Apply (example):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f backend/sql/maintenance/cancel_legacy_vault_submission_drafts.sql

BEGIN;

UPDATE vault_submissions
SET
  status = 'cancelled',
  updated_at = NOW()
WHERE status = 'draft'
  AND tracking_number IS NULL
  AND shipped_at IS NULL
  AND carrier IS NULL;

COMMIT;
