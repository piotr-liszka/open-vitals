#!/usr/bin/env bash
#
# dev-https.sh — run the DEV stack behind trusted local HTTPS using Tailscale Serve.
#
# What it does:
#   1. Locates the Tailscale CLI and this node's MagicDNS name (…​.ts.net).
#   2. Starts the Docker dev stack (docker-compose.dev.yml) with DEV_HTTPS=1 and the
#      https PUBLIC_BASE_URL, so Vite serves for a TLS-terminating proxy.
#   3. Puts Tailscale Serve in front: TLS terminates on <node>.ts.net:443 and forwards
#      https/wss to the plain-HTTP Vite dev server on localhost:3000.
#
# Prereqs (one-time, free): enable HTTPS certificates for the tailnet at
#   https://login.tailscale.com/admin/dns  →  "Enable HTTPS…"
#
# Usage:
#   scripts/dev-https.sh          # start (foreground: docker logs; Ctrl-C to stop stack)
#   scripts/dev-https.sh --down   # stop the stack and reset the serve config
set -euo pipefail
cd "$(dirname "$0")/.."

# Published host port for the web service. docker compose reads WEB_PORT from .env for the
# `${WEB_PORT:-3000}:3000` mapping, so mirror that here (shell env wins, then .env, then 3000)
# to point the proxy at the right port.
PORT="${WEB_PORT:-}"
if [ -z "$PORT" ] && [ -f .env ]; then
  PORT="$(grep -E '^WEB_PORT=' .env | tail -1 | sed -E 's/^WEB_PORT=//; s/[^0-9]//g')"
fi
PORT="${PORT:-3000}"

# --- locate the Tailscale CLI (PATH, then the macOS app bundle, then common installs) ---
find_ts() {
  if command -v tailscale >/dev/null 2>&1; then command -v tailscale; return; fi
  for p in \
    "/Applications/Tailscale.app/Contents/MacOS/Tailscale" \
    "/usr/local/bin/tailscale" \
    "/opt/homebrew/bin/tailscale"; do
    [ -x "$p" ] && { echo "$p"; return; }
  done
  return 1
}
TS="$(find_ts)" || { echo "error: tailscale CLI not found (is Tailscale installed and running?)"; exit 1; }

# --- teardown ---
if [ "${1:-}" = "--down" ]; then
  echo "Resetting Tailscale serve config…"
  "$TS" serve reset || true
  echo "Stopping dev stack…"
  docker compose -f docker-compose.dev.yml down
  exit 0
fi

# --- this node's MagicDNS name (Self.DNSName, trailing dot stripped) ---
get_dns_name() {
  local json; json="$("$TS" status --json 2>/dev/null)"
  if command -v python3 >/dev/null 2>&1; then
    printf '%s' "$json" | python3 -c 'import sys,json; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))'
  else
    # Fallback: Self is the first object in the JSON, so its DNSName is the first match.
    printf '%s' "$json" | grep -o '"DNSName": *"[^"]*"' | head -1 | sed -E 's/.*"([^"]*)"/\1/; s/\.$//'
  fi
}
DNS_NAME="$(get_dns_name)"
[ -n "$DNS_NAME" ] || { echo "error: could not determine this node's .ts.net name from 'tailscale status'"; exit 1; }
URL="https://${DNS_NAME}"

echo "==> Tailscale node : ${DNS_NAME}"
echo "==> HTTPS URL      : ${URL}"
echo

# --- put the TLS proxy in front of the (not-yet-running) dev server, in the background ---
# `serve` provisions the Let's Encrypt cert on first use; if HTTPS certs are not enabled for the
# tailnet it fails here with a clear message pointing at the admin console.
echo "==> Configuring Tailscale Serve (${URL} → http://localhost:${PORT})…"
if ! "$TS" serve --bg --https=443 "http://127.0.0.1:${PORT}"; then
  echo
  echo "error: 'tailscale serve' failed. If it said TLS certs are not supported, enable HTTPS at:"
  echo "       https://login.tailscale.com/admin/dns  →  \"Enable HTTPS…\"  (free, one-time)"
  exit 1
fi
"$TS" serve status || true
echo

# --- start the dev stack pointed at the https origin (foreground: streams logs) ---
echo "==> Starting dev stack (DEV_HTTPS=1, PUBLIC_BASE_URL=${URL})…"
echo "    Open ${URL} once it's up.  Ctrl-C stops the stack; run '$0 --down' to also reset serve."
echo
DEV_HTTPS=1 PUBLIC_BASE_URL="${URL}" docker compose -f docker-compose.dev.yml up
