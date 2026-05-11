## Goal

Make the GitHub Actions test pipeline flake-resistant: known-flaky specs get a single deterministic rerun, real regressions still fail immediately, and the quarantine list cannot rot.

## Pieces

### 1. Quarantine manifest (new) — `.github/flaky-tests.json`

Single source of truth, machine-readable. Format:

```json
{
  "vitest": [
    {
      "pattern": "src/test/security/edge-function-hsts-referrer-csp.test.ts > .* > resolved bag carries",
      "reason": "Intermittent ENOENT when shared http-headers.ts is re-read mid-scan",
      "owner": "@security",
      "added": "2026-05-11",
      "expires": "2026-06-10",
      "issue": "https://github.com/<org>/<repo>/issues/1234"
    }
  ],
  "playwright": [
    {
      "pattern": "e2e/superadmin-mocked-auth.spec.ts > .* > system admin: reaches Superadmin page",
      "reason": "VITE_SUPABASE_URL race on cold cache",
      "owner": "@platform",
      "added": "2026-05-11",
      "expires": "2026-06-10",
      "issue": "..."
    }
  ]
}
```

Rules enforced by `scripts/ci/check-quarantine.mjs`:
- Every entry MUST have `pattern`, `reason`, `owner`, `added`, `expires`, `issue`.
- `expires` MUST be within 30 days of `added` and not in the past.
- Manifest is sorted, no duplicate patterns.
- Total size capped (default 15 entries) to keep quarantine pressure honest.

### 2. Rerun helper (new) — `scripts/ci/rerun-flaky.mjs`

Pure Node (no extra deps). Inputs:
- A junit XML path (Vitest or Playwright).
- The manifest section name (`vitest` | `playwright`).
- A rerun command template.

Behaviour:
1. Parse junit, collect every `<testcase>` with a `<failure>` or `<error>` child. Build full IDs (`classname > name`).
2. Match each failed ID against the manifest patterns (regex, anchored).
3. If any failed ID is NOT covered by quarantine: print the offenders and exit 2 (real regression).
4. If all failures are quarantined: invoke the rerun command with deterministic env and only the failed test IDs scoped down (`--testNamePattern` for Vitest, `--grep` for Playwright). Exit 0 if rerun passes, exit 3 if it still fails.

Deterministic env applied to reruns:
- `TZ=UTC`, `LANG=C.UTF-8`, `LC_ALL=C.UTF-8`
- `CI=true`, `FORCE_COLOR=0`
- `VITEST_SEED=0`, `--sequence.shuffle=false`, `--no-isolate=false`, `--pool=forks`, `--poolOptions.forks.singleFork=true`
- Playwright: `--workers=1 --retries=0 --repeat-each=1 --max-failures=10`, `PW_TEST_HTML_REPORT_OPEN=never`
- `--reporter=junit` written to a separate `*-rerun.xml` so artifacts contain both attempts

### 3. Workflow integration

Edit `.github/workflows/test-ci.yml` — split the single `npm run test:ci` step into three explicit steps so junit XML is available between attempts:

```text
Lint → Typecheck → Vitest (initial) → Vitest rerun (if failed) →
Deno tests → Playwright (initial) → Playwright rerun (if failed) →
Quarantine hygiene check → Upload reports
```

Each rerun step uses `if: failure() && steps.<initial>.outcome == 'failure'`, calls `scripts/ci/rerun-flaky.mjs`, and either:
- exits 0 (job continues, summary annotated `::warning::Flaky: N tests recovered on rerun`), or
- exits non-zero (job fails with the offending test list pinned to the GitHub step summary).

The hygiene check runs on every push and fails if the manifest is malformed, expired, or oversized — so quarantine cannot silently pile up.

Also add the same two-attempt pattern to `.github/workflows/ci.yml` for the unit-test step (schema gate keeps `--bail=1`, no rerun there since it's a deterministic file parser).

### 4. Reporting

- Step summary lists: passed, failed, quarantined-recovered, quarantined-still-failing, expired-quarantine-entries.
- Artifacts now include `test-reports/<suite>/junit.xml` AND `test-reports/<suite>/junit-rerun.xml` so PR reviewers can see the diff between attempts.

## Files

New:
- `.github/flaky-tests.json` (empty list, schema documented in repo docs)
- `scripts/ci/rerun-flaky.mjs`
- `scripts/ci/check-quarantine.mjs`
- `scripts/ci/parse-junit.mjs` (shared)
- `src/test/ci/check-quarantine.test.ts` (Vitest unit tests for the parser + hygiene rules — runs under the existing schema gate so the tooling itself never silently breaks)

Edited:
- `.github/workflows/test-ci.yml` (split steps, add rerun + hygiene)
- `.github/workflows/ci.yml` (add Vitest rerun for the unit-test step)
- `playwright.config.ts` (drop the implicit `retries: 2` — reruns are now explicit and only for quarantined tests, so green CI never hides flake)

## Non-goals

- No change to Deno edge tests (already deterministic, no flake history).
- No change to lint/typecheck/build (deterministic by construction).
- No mass-quarantine; manifest ships empty and is opt-in per failing test with an expiry.
