-- KBW event ended — remove web2 mystery-card burn ledger.
-- Safe to re-run.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f backend/sql/maintenance/drop_kbw_mystery_card_burns.sql

DROP TABLE IF EXISTS kbw_mystery_card_burns;
