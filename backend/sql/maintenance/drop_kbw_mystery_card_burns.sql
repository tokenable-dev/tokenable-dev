-- KBW event ended — remove web2 mystery-card burn ledger.
-- NOT in deploy-sync.sql / apply-deploy-maintenance.sh — event may still be active; run only after product sign-off.
-- Safe to re-run.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f backend/sql/maintenance/drop_kbw_mystery_card_burns.sql

DROP TABLE IF EXISTS kbw_mystery_card_burns;
