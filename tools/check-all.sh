#!/usr/bin/env bash
# Run every automated check in the repo. Needs: node 22, and (for browser tests) global `playwright` + `http-server` with Chromium installed.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -x tools/lint/node_modules/.bin/eslint ]; then
  echo "== lint + format"; npm --prefix tools/lint run lint && npm --prefix tools/lint run format:check
else
  echo "== lint + format: SKIPPED (install once with: npm --prefix tools/lint ci)"
fi
echo "== engine";      (cd packages/engine && npm run check)
echo "== curriculum";  (cd packages/curriculum && npm run check)
echo "== tutor proxy"; (cd apps/tutor-proxy && npm test)
echo "== web build";   (cd apps/web && npm run build)
export NODE_PATH="$(npm root -g)"
echo "== browser: web app";   node e2e/web-app.cjs
echo "== browser: web app (extra)"; node e2e/web-app-extra.cjs
echo "== browser: lab UX"; node e2e/web-app-labs.cjs
echo "== browser: state machines"; node e2e/web-app-states.cjs
echo "== browser: tutor panel ↔ proxy (mock upstream)"; node e2e/web-app-tutor.cjs
echo "== browser: V1 slice (skills, Hindi draft, outcomes, axe)"; node e2e/web-app-v1.cjs
echo "== browser: Trial Balance Crisis challenge"; node e2e/web-app-crisis.cjs
echo "== browser: Phase 1 look (home, labs index, header, icons)"; node e2e/web-app-polish.cjs
echo "== browser: one language switch (English / Hindi draft)"; node e2e/web-app-lang.cjs
echo "== browser: published site layout (/ and /legacy/)"; node e2e/web-app-site.cjs
echo "== browser: legacy";    node e2e/legacy-smoke.cjs && node e2e/legacy-simulator-regression.cjs
echo "ALL CHECKS PASSED"
