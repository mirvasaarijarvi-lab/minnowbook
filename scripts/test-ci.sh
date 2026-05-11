#!/usr/bin/env bash
# CI test runner: runs unit, Deno edge function, and Playwright e2e tests.
# Fails fast on the first failing suite (set -e) and prints which suite broke.
set -euo pipefail

run_step() {
  local name="$1"; shift
  echo ""
  echo "=============================================="
  echo "▶ $name"
  echo "=============================================="
  if ! "$@"; then
    echo ""
    echo "❌ $name FAILED — aborting CI run"
    exit 1
  fi
  echo "✅ $name passed"
}

# 1. Vitest unit tests (fail fast on first failing file, no watch, minimal reporter)
run_step "Unit tests (Vitest)" \
  node --no-warnings ./node_modules/vitest/vitest.mjs run --bail=1 --reporter=dot

# 2. Deno tests for Supabase edge functions
if command -v deno >/dev/null 2>&1; then
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
