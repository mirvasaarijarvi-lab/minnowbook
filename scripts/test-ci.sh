#!/usr/bin/env bash
# CI test runner: runs unit, Deno edge function, and Playwright e2e tests.
# Fails fast on the first failing suite (set -e) and prints which suite broke.
set -euo pipefail

# All machine-readable test reports land here; CI uploads this folder as an
# artifact so failures include junit XML, JSON results, and full stack traces.
REPORTS_DIR="${REPORTS_DIR:-test-reports}"
mkdir -p "$REPORTS_DIR/vitest" "$REPORTS_DIR/deno" "$REPORTS_DIR/playwright"

run_step() {
  local name="$1"; shift
  echo ""
  echo "=============================================="
  echo "▶ $name"
  echo "=============================================="
  if ! "$@"; then
    echo ""
    echo "❌ $name FAILED — aborting CI run (reports in $REPORTS_DIR)"
    exit 1
  fi
  echo "✅ $name passed"
}

# 1. Vitest unit tests (fail fast on first failing file, dot reporter to keep
#    console quiet, junit + json reporters write into $REPORTS_DIR/vitest/).
run_step "Unit tests (Vitest)" \
  node --no-warnings ./node_modules/vitest/vitest.mjs run \
    --bail=1 \
    --reporter=dot \
    --reporter=junit \
    --reporter=json

# 2. Deno tests for Supabase edge functions
if command -v deno >/dev/null 2>&1; then
  # Local-dev convenience: if neither SUPABASE_URL nor VITE_SUPABASE_URL is
  # exported, source the project root .env so `bun run test:ci` works without
  # the developer having to manually export every var. CI runs already export
  # these via the workflow `env:` block, so the file load is a no-op there.
  if [ -z "${SUPABASE_URL:-}" ] && [ -z "${VITE_SUPABASE_URL:-}" ] && [ -f .env ]; then
    echo "[preflight] loading .env (no SUPABASE_URL/VITE_SUPABASE_URL exported)"
    set -a
    # shellcheck disable=SC1091
    . ./.env
    set +a
  fi
  # Allow VITE_SUPABASE_URL to satisfy SUPABASE_URL for local/CI parity.
  if [ -z "${SUPABASE_URL:-}" ] && [ -n "${VITE_SUPABASE_URL:-}" ]; then
    export SUPABASE_URL="$VITE_SUPABASE_URL"
  fi

  # ---------------------------------------------------------------------------
  # Preflight banner: scannable status of every env var the Deno edge
  # function suite cares about, plus the EXACT tests that get
  # skipped/degraded when SUPABASE_SERVICE_ROLE_KEY is missing. A first-time
  # contributor running `bun run test:ci` should be able to tell at a
  # glance which tests are running and which are not, and how to upgrade
  # to the full suite. Policy must match .github/workflows/test-ci.yml.
  # ---------------------------------------------------------------------------
  echo ""
  echo "=============================================="
  echo "  Preflight: Supabase env vars (Deno tests)"
  echo "=============================================="

  url_present=0
  key_present=0
  [ -n "${SUPABASE_URL:-}" ] && url_present=1
  [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ] && key_present=1

  if [ "$url_present" = "1" ]; then
    echo "  [OK]   SUPABASE_URL              : present"
  else
    echo "  [FAIL] SUPABASE_URL              : MISSING (required)"
  fi
  if [ "$key_present" = "1" ]; then
    echo "  [OK]   SUPABASE_SERVICE_ROLE_KEY : present"
  else
    echo "  [WARN] SUPABASE_SERVICE_ROLE_KEY : MISSING (recommended)"
  fi
  echo ""

  if [ "$url_present" = "0" ]; then
    echo "ERROR: SUPABASE_URL (or VITE_SUPABASE_URL) is required for the"
    echo "       Deno edge function tests. Without it no function endpoint"
    echo "       can be reached, so the entire suite would fail."
    echo ""
    echo "  Local dev: add VITE_SUPABASE_URL to your .env file."
    echo "  CI:        add SUPABASE_URL under Settings > Secrets and"
    echo "             variables > Actions, then re-run the workflow."
    exit 1
  fi

  if [ "$key_present" = "0" ]; then
    if [ "${REQUIRE_SERVICE_ROLE_KEY:-0}" = "1" ]; then
      echo "ERROR: SUPABASE_SERVICE_ROLE_KEY is missing and"
      echo "       REQUIRE_SERVICE_ROLE_KEY=1 is set. Failing the run."
      echo ""
      echo "  Add the service-role key from Lovable Cloud (Backend > API"
      echo "  keys), then re-run."
      exit 1
    fi
    cat <<'EOF'
WARNING: SUPABASE_SERVICE_ROLE_KEY is not set. The Deno edge function
         suite will run in DEGRADED mode. Specifically:

  Tests that will SKIP their DB-writing / DB-verification step:
    - public-booking/index.test.ts
        * "public-booking: creates a pending reservation end-to-end"
          runs the request but skips post-insert DB verification and
          row cleanup (cannot DELETE without the service role).
    - public-booking/schema.test.ts
        * Schema introspection assertions that need service-role SELECT
          on system tables print "skipping schema test" and bail early.

  Tests that will run in VALIDATE-ONLY mode (no insert path exercised):
    - public-booking/index.test.ts
        * "public-booking: no data leak when SUPABASE_SERVICE_ROLE_KEY
          is missing" sends an intentionally invalid payload so the
          function rejects it with 400 before any row is written.

  Tests that will be IGNORED entirely:
    - public-booking/index.test.ts
        * "public-booking: validation-only request leaves reservations
          row count unchanged" needs service-role count=exact access.

  To run the FULL suite, add the service-role key from Lovable Cloud
  (Backend > API keys):
    - Local dev: export SUPABASE_SERVICE_ROLE_KEY=... before running
      `bun run test:ci`, or put it in a gitignored .env.local you
      source.
    - CI: add SUPABASE_SERVICE_ROLE_KEY under Settings > Secrets and
      variables > Actions. Set repo variable REQUIRE_SERVICE_ROLE_KEY=1
      to make a missing key a hard failure on protected branches.
EOF
    echo ""
  else
    echo "  Full Deno suite enabled (no tests skipped)."
    echo ""
  fi

  # Deno's --junit-path emits a JUnit XML alongside the normal console output,
  # giving CI a structured report with per-test stack traces.
  run_step "Edge function tests (Deno)" \
    deno test --allow-net --allow-env --allow-read \
      --junit-path="$REPORTS_DIR/deno/junit.xml" \
      supabase/functions/
else
  echo "WARNING: Deno not installed, skipping edge function tests"
  echo "  Install: https://docs.deno.com/runtime/getting_started/installation/"
  exit 1
fi

# 3. Playwright e2e (junit + json reporters configured in playwright.config.ts;
#    html report stays under playwright-report/, traces/screenshots/videos
#    under test-results/).
run_step "E2E tests (Playwright)" npx playwright test

echo ""
echo "🎉 All test suites passed (reports in $REPORTS_DIR)"
