#!/bin/bash

#
# GitHub Webhook Listener for Server Restart
#
# This script listens for GitHub push events on main branch and restarts the server.
# Useful for development with ngrok or similar tunneling service.
#
# Usage:
#   bash scripts/webhook-restart.sh [port]
#
# Default port: 9000
#

PORT="${1:-9000}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="${PROJECT_ROOT}/logs/webhook-restart.log"
PID_FILE="/tmp/server.pid"

# Ensure logs directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  local message="[$timestamp] $1"
  echo "$message"
  echo "$message" >> "$LOG_FILE"
}

# Kill server function
kill_server() {
  if [ -f "$PID_FILE" ]; then
    local pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      log "Killing server process (PID: $pid)"
      kill -TERM "$pid" 2>/dev/null || true

      # Wait up to 5 seconds for graceful shutdown
      local count=0
      while kill -0 "$pid" 2>/dev/null && [ $count -lt 5 ]; do
        sleep 1
        count=$((count + 1))
      done

      # Force kill if still running
      if kill -0 "$pid" 2>/dev/null; then
        log "Force killing server process"
        kill -KILL "$pid" 2>/dev/null || true
      fi
    fi
    rm -f "$PID_FILE"
  fi
}

# Restart server function
restart_server() {
  log "Restarting server..."
  kill_server

  cd "$PROJECT_ROOT"

  # Start server in background
  npm start > /tmp/server-webhook.log 2>&1 &
  local new_pid=$!
  echo "$new_pid" > "$PID_FILE"

  log "Server started with PID: $new_pid"
}

# Handle webhook endpoint
handle_webhook() {
  local event=$1
  local branch=$2

  if [ "$event" = "push" ] && [ "$branch" = "main" ]; then
    log "Received push event on main branch"
    restart_server
  else
    log "Ignoring event: $event on branch: $branch"
  fi
}

log "Webhook listener started on port $PORT"
log "Listening for GitHub push events to main branch"

# Simple HTTP server using nc (netcat)
while true; do
  {
    read -r request

    if echo "$request" | grep -q "POST /webhook"; then
      # Read the rest of the headers
      while read -r header; do
        if [ "$header" = $'\r' ] || [ "$header" = "" ]; then
          break
        fi
      done

      # Read body (GitHub sends JSON)
      read -r body

      # Parse JSON to extract event type and branch (basic parsing)
      if echo "$body" | grep -q '"ref":"refs/heads/main"'; then
        handle_webhook "push" "main"
        echo "HTTP/1.1 200 OK"
        echo "Content-Type: application/json"
        echo ""
        echo '{"ok":true}'
      else
        echo "HTTP/1.1 200 OK"
        echo "Content-Type: application/json"
        echo ""
        echo '{"ok":true}'
      fi
    else
      echo "HTTP/1.1 200 OK"
      echo "Content-Type: text/plain"
      echo ""
      echo "Webhook listener running"
    fi
  } | nc -l -p "$PORT" -q 1
done
