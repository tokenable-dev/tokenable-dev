#!/usr/bin/env bash
# Apply canonical schema to Postgres (works with stdin pipe — no psql \ir needed).
# Usage:
#   DATABASE_URL=postgres://tokenable:tokenable@localhost:5432/tokenable ./scripts/bootstrap-db.sh
#   docker exec -i tokenable-postgres env PGPASSWORD=tokenable \
#     ./scripts/bootstrap-db.sh   # when script is mounted in container
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -n "${DATABASE_URL:-}" ]]; then
  PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1)
elif [[ -n "${PGHOST:-}" ]]; then
  PSQL=(psql -v ON_ERROR_STOP=1)
else
  PSQL=(psql -U "${PGUSER:-tokenable}" -d "${PGDATABASE:-tokenable}" -v ON_ERROR_STOP=1)
fi

{
  echo "BEGIN;"
  for f in "$ROOT/schema/"*.sql; do
    echo "-- >>> $(basename "$f")"
    cat "$f"
  done
  echo "COMMIT;"
} | "${PSQL[@]}"

echo "bootstrap complete ($(basename "$ROOT"))"
