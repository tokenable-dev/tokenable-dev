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

# Add new idempotent maintenance/*.sql here when the API entity layer depends on them.
FILES=(
  maintenance/add_vault_submission_item_display_fields.sql
  maintenance/add_vault_cycles_mint_attempt.sql
  maintenance/nullable_rwa_tokens_settlement_policy.sql
)

run_psql() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 "$@"
    return
  fi
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'tokenable-postgres'; then
    docker exec -i tokenable-postgres psql -U "${PGUSER:-tokenable}" -d "${PGDATABASE:-tokenable}" -v ON_ERROR_STOP=1 "$@"
    return
  fi
  psql -U "${PGUSER:-tokenable}" -d "${PGDATABASE:-tokenable}" -v ON_ERROR_STOP=1 "$@"
}

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
