#!/usr/bin/env bash
# Cloud Agent start phase — per-boot infra reconciliation.
# Brings up Postgres + Redis, then returns. Idempotent: safe if already running.
# Dev servers run as terminals (see .cursor/environment.json), not here.
set -euo pipefail

echo "[start] starting postgresql cluster"
sudo pg_ctlcluster 16 main start 2>/dev/null || true
for _ in $(seq 1 30); do
  sudo -u postgres pg_isready >/dev/null 2>&1 && break
  sleep 1
done
sudo -u postgres pg_isready || echo "[start] WARNING: postgres not ready"

echo "[start] starting redis"
if ! redis-cli -p 6379 ping >/dev/null 2>&1; then
  redis-server --daemonize yes --port 6379 --appendonly no
fi
redis-cli -p 6379 ping >/dev/null 2>&1 && echo "[start] redis ready" || echo "[start] WARNING: redis not ready"

echo "[start] infra ready (postgres:5432, redis:6379)"
