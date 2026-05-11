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

  # Required env vars for Deno edge function tests. Fail fast with a clear list
  # of what's missing so CI logs explain the failure without diving into Deno output.
  required_env=(SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY)
  missing_env=()
  for var in "${required_env[@]}"; do
    if [ -z "${!var:-}" ]; then
      missing_env+=("$var")
    fi
  done
  if [ "${#missing_env[@]}" -gt 0 ]; then
    echo ""
    echo "❌ Edge function tests (Deno) cannot run: missing required env var(s):"
    for var in "${missing_env[@]}"; do
      echo "   - $var"
    done
    echo ""
    echo "Set these in your CI environment (e.g. GitHub Actions secrets) before"
    echo "running scripts/test-ci.sh. SUPABASE_SERVICE_ROLE_KEY must be the"
    echo "service-role key from Lovable Cloud (Backend → API keys)."
    exit 1
  fi

  run_step "Edge function tests (Deno)" \
    deno test --allow-net --allow-env --allow-read supabase/functions/
else
  echo "⚠ Deno not installed — skipping edge function tests"
  echo "  Install: https://docs.deno.com/runtime/getting_started/installation/"
  exit 1
fi

# 3. Playwright e2e
run_step "E2E tests (Playwright)" npx playwright test

echo ""
echo "🎉 All test suites passed"
