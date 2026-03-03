#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="/opt/ksr-tg-bot-panel"

if [[ ! -d "$TARGET_DIR" ]]; then
  echo "Target directory $TARGET_DIR not found. Is the panel installed?" >&2
  exit 1
fi

cd "$TARGET_DIR"

echo "==> Rebuilding and restarting KSR TG Bot Panel..."
docker compose -f docker/docker-compose.yml pull || true
docker compose -f docker/docker-compose.yml up -d --build

echo "Update triggered. Check 'docker ps' and container logs for status."

