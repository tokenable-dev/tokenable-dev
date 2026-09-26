#!/usr/bin/env bash
# Idempotent maintenance SQL — safe to run on every deploy (existing DBs only).
#
# Usage (EC2 / docker-compose):
#   cd /home/ubuntu/app && bash backend/sql/scripts/apply-deploy-maintenance.sh
#
# Usage (DATABASE_URL):
#   DATABASE_URL=postgres://... backend/sql/scripts/apply-deploy-maintenance.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-tokenable-postgres}"
PGUSER="${PGUSER:-tokenable}"
PGDATABASE="${PGDATABASE:-tokenable}"
PG_WAIT_SECS="${MAINTENANCE_PG_WAIT_SECS:-120}"
PG_ATTEMPTS="${MAINTENANCE_PG_ATTEMPTS:-8}"

# Add new idempotent maintenance/*.sql here when the API entity layer depends on them.
FILES=(
  maintenance/add_vault_submission_item_display_fields.sql
  maintenance/add_vault_cycles_mint_attempt.sql
  maintenance/add_marketplace_collections_token_contract.sql
  maintenance/add_vault_submissions_token_contract.sql
  maintenance/add_portfolio_daily_snapshots_token_contract.sql
  maintenance/nullable_rwa_tokens_settlement_policy.sql
  maintenance/user_buyer_listing_alert_token_contract.sql
  maintenance/drop_legacy_unused_tables.sql
  maintenance/add_kbw_mystery_card_burns.sql
  maintenance/drop_users_email_unique.sql
)

postgres_via_docker() {
  docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$POSTGRES_CONTAINER"
}

wait_for_postgres() {
  local elapsed=0
  while (( elapsed < PG_WAIT_SECS )); do
    if [[ -n "${DATABASE_URL:-}" ]]; then
      if psql "$DATABASE_URL" -q -c 'SELECT 1' >/dev/null 2>&1; then
        return 0
      fi
    elif postgres_via_docker; then
      if docker exec "$POSTGRES_CONTAINER" pg_isready -U "$PGUSER" -d "$PGDATABASE" -q 2>/dev/null; then
        return 0
      fi
    else
      if psql -U "$PGUSER" -d "$PGDATABASE" -q -c 'SELECT 1' >/dev/null 2>&1; then
        return 0
      fi
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  echo "apply-deploy-maintenance: postgres not ready after ${PG_WAIT_SECS}s" >&2
  return 1
}

run_psql_once() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 "$@"
    return
  fi
  if postgres_via_docker; then
    docker exec -i "$POSTGRES_CONTAINER" psql -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 "$@"
    return
  fi
  psql -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 "$@"
}

run_psql() {
  local attempt=1
  while (( attempt <= PG_ATTEMPTS )); do
    if run_psql_once "$@"; then
      return 0
    fi
    echo "apply-deploy-maintenance: psql failed (attempt ${attempt}/${PG_ATTEMPTS})" >&2
    wait_for_postgres || true
    sleep $((attempt * 2))
    attempt=$((attempt + 1))
  done
  return 1
}

echo "apply-deploy-maintenance: waiting for postgres"
wait_for_postgres

for rel in "${FILES[@]}"; do
  f="$ROOT/$rel"
  if [[ ! -f "$f" ]]; then
    echo "apply-deploy-maintenance: missing $f" >&2
    exit 1
  fi
  echo "apply-deploy-maintenance: $(basename "$f")"
  run_psql < "$f"
done

echo "apply-deploy-maintenance: complete (${#FILES[@]} file(s))"
