#!/usr/bin/env bash
set -euo pipefail
REPO=$(cd "$(dirname "$0")/.." && pwd)

# 1. Clean databases for a fresh run
rm -rf "$REPO/botdentity/data" "$REPO/botstore/data"

# 2. Start servers in background, log to e2e/*.log
(cd "$REPO/botdentity" && NODE_OPTIONS='--experimental-sqlite' npm run dev \
  >"$REPO/e2e/botdentity.log" 2>&1) & BD=$!
(cd "$REPO/botstore" && BOTDENTITY_URL=http://localhost:3001 \
  NODE_OPTIONS='--experimental-sqlite' npm run dev \
  >"$REPO/e2e/botstore.log" 2>&1) & BS=$!

trap "kill $BD $BS 2>/dev/null || true" EXIT

# 3. Wait for readiness
wait_for_200() {
  for i in $(seq 60); do
    [[ "$(curl -s -o /dev/null -w '%{http_code}' "$1")" == "200" ]] && return 0
    sleep 1
  done
  echo "Timeout waiting for $1"; exit 1
}
wait_for_any() {
  for i in $(seq 60); do
    CODE=$(curl -s -o /dev/null -w '%{http_code}' "$1")
    [[ "$CODE" != "000" ]] && return 0
    sleep 1
  done
  echo "Timeout waiting for $1"; exit 1
}

wait_for_200 http://localhost:3001/api/jwks
wait_for_any  http://localhost:3002/api/blobs

# 4. Run tests
node "$REPO/e2e/tests.mjs"
