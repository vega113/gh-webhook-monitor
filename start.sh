#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Load env
if [[ -f .env ]]; then
  set -a; source .env; set +a
fi

# Start named cloudflared tunnel in background
cloudflared tunnel --config "$SCRIPT_DIR/tunnel-config.yml" run gh-webhook &
TUNNEL_PID=$!

cleanup() {
  kill $TUNNEL_PID 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

# Run node server in foreground (launchd manages this process)
exec node server.js
