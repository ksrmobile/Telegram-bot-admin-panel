#!/usr/bin/env bash
set -euo pipefail

PORT="${PANEL_PORT:-8080}"
HOST="${PANEL_HOST:-127.0.0.1}"

curl -fsS "http://$HOST:$PORT/api/health" >/dev/null

