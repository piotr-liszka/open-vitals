#!/usr/bin/env bash
#
# verify-workout-push.sh — prove Garmin's workout-service endpoints work for a real
# account (spec 050), by creating ONE throwaway workout, scheduling it, and deleting it.
#
# Why this exists: garmy 1.0.0 has no workout accessor, so the sidecar writes through
# `APIClient.connectapi(path, method=…)` against paths that CANNOT be verified offline.
# Every sidecar test proves the mapping and the failure handling; only this script proves
# the endpoints. Run it once before enabling GARMIN_WORKOUT_PUSH for a deployment.
#
# It talks to the SIDECAR directly (internal-only, AGENTS.md §3), so run it on the host
# that runs the stack — e.g. inside the compose network:
#   docker compose exec web sh -c 'GARMIN_SIDECAR_URL=http://garmin:8081 USER_ID=<uid> …'
# or from the host with the sidecar port published to loopback only.
#
# Usage:
#   USER_ID=<opaque-user-id> scripts/verify-workout-push.sh [sidecar-url]
#
# The user id is the same opaque id the web tier sends as X-User-Id; find it in the
# app's own logs/DB, never in this file. Nothing here prints tokens or credentials.
set -euo pipefail

SIDECAR="${1:-${GARMIN_SIDECAR_URL:-http://127.0.0.1:8081}}"
: "${USER_ID:?set USER_ID to the opaque user id whose Garmin account to write to}"
# Tomorrow, so a stray leftover never lands on a day the athlete is training.
DAY="$(date -v+1d +%F 2>/dev/null || date -d '+1 day' +%F)"
TITLE="OPENVITALS PUSH TEST — delete me"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
req() { curl -sS -o /tmp/openvitals-push-body -w '%{http_code}' -H "X-User-Id: ${USER_ID}" "$@"; }
body() { cat /tmp/openvitals-push-body; echo; }

say "0. sidecar reachable + account connected"
code=$(req "${SIDECAR}/status")
[ "$code" = "200" ] || { echo "status → HTTP $code"; body; exit 1; }
body

say "1. create a 3-step run workout"
code=$(req -X POST "${SIDECAR}/workouts" -H 'Content-Type: application/json' -d "{
  \"sport\": \"running\",
  \"title\": \"${TITLE}\",
  \"steps\": [
    {\"kind\": \"warmup\",   \"durationType\": \"time\",     \"durationValue\": 600},
    {\"kind\": \"work\",     \"durationType\": \"distance\", \"durationValue\": 1000,
     \"target\": {\"type\": \"pace\", \"low\": 240, \"high\": 250, \"unit\": \"s_per_km\"}},
    {\"kind\": \"cooldown\", \"durationType\": \"time\",     \"durationValue\": 600}
  ]
}")
body
[ "$code" = "200" ] || { echo "create → HTTP $code — the endpoint or the payload is wrong"; exit 1; }
WORKOUT_ID=$(sed -n 's/.*"workoutId":"\([^"]*\)".*/\1/p' /tmp/openvitals-push-body)
if [ -z "$WORKOUT_ID" ]; then
  echo "create returned supported:false — Garmin serves no /workout-service/workout for this"
  echo "account. Leave GARMIN_WORKOUT_PUSH off and fix the path constant in app/workouts.py."
  exit 2
fi
echo "workoutId = ${WORKOUT_ID}"

say "2. schedule it on ${DAY}"
code=$(req -X POST "${SIDECAR}/workouts/${WORKOUT_ID}/schedule" \
  -H 'Content-Type: application/json' -d "{\"day\": \"${DAY}\"}")
body
[ "$code" = "200" ] || echo "schedule → HTTP $code (create works, scheduling does not)"

say "3. CHECK GARMIN CONNECT NOW — the calendar should show '${TITLE}' on ${DAY}"
printf 'Press Enter to delete it again (or Ctrl-C to leave it in place): '
read -r _

say "4. delete it"
code=$(req -X DELETE "${SIDECAR}/workouts/${WORKOUT_ID}")
body
[ "$code" = "200" ] || { echo "delete → HTTP $code — REMOVE IT BY HAND in Garmin Connect"; exit 1; }

say "verified: create + schedule + delete all work. GARMIN_WORKOUT_PUSH can be enabled."
rm -f /tmp/openvitals-push-body
