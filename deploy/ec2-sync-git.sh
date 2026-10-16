#!/usr/bin/env bash
# EC2 ~/app: match origin without losing live nginx.tls.conf edits.
# Removes manual nginx.tls.conf.bak.* (untracked) that block some git operations.
set -euo pipefail

BRANCH="${1:-develop}"
APP_DIR="${2:-/home/ubuntu/app}"

cd "$APP_DIR"

TLS_CONF="$APP_DIR/nginx/nginx.tls.conf"
rm -f "$APP_DIR/nginx/nginx.tls.conf.bak."*
git clean -fd -- "$APP_DIR/nginx/" || true

TLS_BACKUP=""
if [ -f "$TLS_CONF" ]; then
  TLS_BACKUP=$(mktemp)
  cp "$TLS_CONF" "$TLS_BACKUP"
fi

git reset --hard "origin/$BRANCH"

if [ -n "$TLS_BACKUP" ] && [ -s "$TLS_BACKUP" ]; then
  cp "$TLS_BACKUP" "$TLS_CONF"
  rm -f "$TLS_BACKUP"
fi

echo "Synced $APP_DIR to origin/$BRANCH (nginx.tls.conf preserved when present)."
