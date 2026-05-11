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
  # Allow VITE_SUPABASE_URL to satisfy SUPABASE_URL for local/CI parity.
  if [ -z "${SUPABASE_URL:-}" ] && [ -n "${VITE_SUPABASE_URL:-}" ]; then
    export SUPABASE_URL="$VITE_SUPABASE_URL"
  fi

  # Env var policy (must match .github/workflows/test-ci.yml precheck):
  #   * SUPABASE_URL is REQUIRED. Without it the Deno edge tests cannot
  #     reach any function endpoint, so we fail fast.
  #   * SUPABASE_SERVICE_ROLE_KEY is RECOMMENDED. When missing, the Deno
  #     suite gracefully degrades (skips DB-verification, runs validate
  #     only no-leak path, ignores the row-count test). We warn and
  #     continue so forks/PRs without the secret still get useful signal.
  #     Set REQUIRE_SERVICE_ROLE_KEY=1 to promote the warning to a hard
  #     failure (recommended for the main branch's required check).
  if [ -z "${SUPABASE_URL:-}" ]; then
    echo ""
    echo "Edge function tests (Deno) cannot run: missing required env var:"
    echo "   - SUPABASE_URL (or VITE_SUPABASE_URL)"
    echo ""
    echo "Set it in your CI environment (e.g. GitHub Actions secrets) before"
    echo "running scripts/test-ci.sh."
    exit 1
  fi

  if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
    if [ "${REQUIRE_SERVICE_ROLE_KEY:-0}" = "1" ]; then
      echo ""
      echo "SUPABASE_SERVICE_ROLE_KEY is missing and REQUIRE_SERVICE_ROLE_KEY=1."
      echo "   Add the service-role key from Lovable Cloud (Backend > API keys)"
      echo "   under Settings > Secrets and variables > Actions, then re-run."
      exit 1
    fi
    echo ""
    echo "WARNING: SUPABASE_SERVICE_ROLE_KEY is not set. Running Deno edge"
    echo "  tests in DEGRADED mode:"
    echo "    - End-to-end reservation test skips its DB-verification step."
    echo "    - 'No data leak' test runs in validate-only mode (no insert)."
    echo "    - 'Validation-only row count unchanged' test is ignored."
    echo "  Add the service-role key from Lovable Cloud (Backend > API keys)"
    echo "  to run the full suite. Set REQUIRE_SERVICE_ROLE_KEY=1 to make"
    echo "  the missing key a hard failure."
    echo ""
  fi

  # Deno's --junit-path emits a JUnit XML alongside the normal console output,
  # giving CI a structured report with per-test stack traces.
  run_step "Edge function tests (Deno)" \
    deno test --allow-net --allow-env --allow-read \
      --junit-path="$REPORTS_DIR/deno/junit.xml" \
      supabase/functions/
else
  echo "⚠ Deno not installed — skipping edge function tests"
  echo "  Install: https://docs.deno.com/runtime/getting_started/installation/"
  exit 1
fi

# 3. Playwright e2e (junit + json reporters configured in playwright.config.ts;
#    html report stays under playwright-report/, traces/screenshots/videos
#    under test-results/).
run_step "E2E tests (Playwright)" npx playwright test

echo ""
echo "🎉 All test suites passed (reports in $REPORTS_DIR)"
