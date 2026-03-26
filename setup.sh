#!/usr/bin/env bash
set -euo pipefail

# Setup script for gh-webhook-monitor
# Usage: ./setup.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== gh-webhook-monitor setup ==="

# 1. Install dependencies
echo "Installing npm dependencies..."
npm install

# 2. Generate webhook secret if not set
if [[ ! -f .env ]]; then
  SECRET=$(openssl rand -hex 32)
  cat > .env <<EOF
GITHUB_WEBHOOK_SECRET=$SECRET
PORT=3847
CLAUDE_BIN=claude
EOF
  echo "Created .env with generated webhook secret"
  echo ""
  echo "IMPORTANT: Copy this secret to your GitHub webhook settings:"
  echo "  Secret: $SECRET"
  echo ""
else
  echo ".env already exists, skipping"
fi

# Source .env
set -a; source .env; set +a

# 3. Test that claude CLI is available
if command -v "${CLAUDE_BIN:-claude}" &>/dev/null; then
  echo "Claude CLI found: $(which "${CLAUDE_BIN:-claude}")"
else
  echo "WARNING: Claude CLI not found at '${CLAUDE_BIN:-claude}'"
  echo "  Set CLAUDE_BIN in .env to the correct path"
fi

# 4. Test that cloudflared is available
if command -v cloudflared &>/dev/null; then
  echo "cloudflared found: $(which cloudflared)"
else
  echo "WARNING: cloudflared not found"
  echo "  Install with: brew install cloudflare/cloudflare/cloudflared"
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "To start the server:"
echo "  cd $SCRIPT_DIR"
echo "  node server.js"
echo ""
echo "In another terminal, start the tunnel:"
echo "  cloudflared tunnel --url http://localhost:${PORT:-3847}"
echo ""
echo "Then add the webhook to your GitHub repo:"
echo "  1. Go to: https://github.com/vega113/incubator-wave/settings/hooks/new"
echo "  2. Payload URL: <cloudflared-url>/webhook"
echo "  3. Content type: application/json"
echo "  4. Secret: (from .env GITHUB_WEBHOOK_SECRET)"
echo "  5. Events: Select 'Let me select individual events' and check:"
echo "     - Pull request reviews"
echo "     - Pull requests"
echo "     - Check suites"
echo "     - Issues"
echo "     - Issue comments"
echo ""
