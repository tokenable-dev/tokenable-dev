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

# Single idempotent bundle — add new DDL to maintenance/deploy-sync.sql (append a section).
FILES=(
  maintenance/deploy-sync.sql
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

# psql -f, not stdin. \ir is relative to the script file only when psql is given -f.
# A failed stdin run also consumes the file, so a retry would succeed on empty SQL.
run_psql_file() {
  local f="$1"
  if [[ -n "${DATABASE_URL:-}" ]]; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
    return
  fi
  if postgres_via_docker; then
    local dest="/tmp/tokenable-maintenance-sql"
    docker exec "$POSTGRES_CONTAINER" rm -rf "$dest"
    docker cp "$ROOT" "$POSTGRES_CONTAINER:$dest"
    docker exec "$POSTGRES_CONTAINER" \
      psql -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 \
      -f "$dest/maintenance/$(basename "$f")"
    return
  fi
  psql -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 -f "$f"
}

run_psql() {
  local f="$1"
  local attempt=1
  while (( attempt <= PG_ATTEMPTS )); do
    if run_psql_file "$f"; then
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
  run_psql "$f"
done

echo "apply-deploy-maintenance: complete (${#FILES[@]} file(s))"
