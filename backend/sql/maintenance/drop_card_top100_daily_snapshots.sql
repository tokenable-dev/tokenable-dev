-- Drop legacy Cardhedger Top 100 snapshots (feature removed).
-- Safe to re-run.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f backend/sql/maintenance/drop_card_top100_daily_snapshots.sql

DROP TABLE IF EXISTS card_top100_daily_snapshots;
