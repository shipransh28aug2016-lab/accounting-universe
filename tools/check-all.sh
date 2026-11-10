#!/usr/bin/env bash
# Run every automated check in the repo. Needs: node 22, and (for browser tests) global `playwright` + `http-server` with Chromium installed.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== engine";      (cd packages/engine && npm run check)
echo "== curriculum";  (cd packages/curriculum && npm run check)
echo "== tutor proxy"; (cd apps/tutor-proxy && npm test)
echo "== web build";   (cd apps/web && npm run build)
export NODE_PATH="$(npm root -g)"
echo "== browser: web app";   node e2e/web-app.cjs
echo "== browser: web app (extra)"; node e2e/web-app-extra.cjs
echo "== browser: state machines"; node e2e/web-app-states.cjs
echo "== browser: tutor panel ↔ proxy (mock upstream)"; node e2e/web-app-tutor.cjs
echo "== browser: legacy";    node e2e/legacy-smoke.cjs && node e2e/legacy-simulator-regression.cjs
echo "ALL CHECKS PASSED"
