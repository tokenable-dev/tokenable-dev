-- Read-only inventory of empty / quiet public tables.
-- Row estimates come from Postgres stats (exact COUNT is in the admin UI).
--
--   docker exec -i tokenable-postgres psql -U tokenable -d tokenable \
--     -v ON_ERROR_STOP=1 < backend/sql/maintenance/audit_stale_public_tables.sql

SELECT
  t.table_name,
  COALESCE(s.n_live_tup, 0) AS est_rows,
  COALESCE(s.n_tup_ins, 0) AS inserts_since_stats,
  COALESCE(s.n_tup_upd, 0) AS updates_since_stats,
  GREATEST(
    s.last_autoanalyze,
    s.last_analyze,
    s.last_autovacuum,
    s.last_vacuum
  ) AS last_stats_touch,
  CASE
    WHEN COALESCE(s.n_live_tup, 0) = 0 THEN 'empty'
    ELSE 'has_rows'
  END AS fill
FROM information_schema.tables t
LEFT JOIN pg_stat_user_tables s
  ON s.schemaname = 'public' AND s.relname = t.table_name
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY COALESCE(s.n_live_tup, 0), t.table_name;
