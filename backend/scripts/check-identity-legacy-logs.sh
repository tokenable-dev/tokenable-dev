#!/usr/bin/env bash
# P3.20 — Fail if legacy identity log patterns exist in production source.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PATTERN='\[identity:(drift|repair|read|engine)\]'

if grep -R -E -n "${PATTERN}" "${ROOT}/src/" 2>/dev/null; then
  echo ""
  echo "ERROR: Legacy identity log patterns found in src/ (P3.20)."
  echo "Banned: [identity:drift|repair|read|engine]"
  exit 1
fi

echo "OK: no legacy identity log patterns in src/"
