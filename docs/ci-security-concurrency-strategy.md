# CI strategy: security concurrency tests

The security concurrency test class (`code-redemption-*`, `edge-function-*`
CORS + cold-start suites) exercises the deployed backend under parallel
load. These tests are structurally prone to cold-start / timing flakes
that look identical to real regressions in a single CI run. This doc
explains the dedicated rerun/timeout strategy we run for that class, and
the flake-frequency gate that MUST be consulted before adding a new entry
to `.github/flaky-tests.json`.

## Inventory

The set of files under this strategy is declared in
[`.github/security-concurrency-tests.json`](../.github/security-concurrency-tests.json).
Adding a file there opts it into:

- Elevated per-test timeout (`strategy.perTestTimeoutMs`, default 90s).
- Up to `strategy.maxAttempts` deterministic retries with the backoff
  schedule in `strategy.backoffMs`.
- Single-fork execution (`--poolOptions.forks.singleFork=true`) so
  parallel-shard scheduling cannot mask a real failure or amplify a
  flake.
- Attempt-level frequency tracking (see below).

## Execution model

The runner is
[`scripts/ci/rerun-security-concurrency.mjs`](../scripts/ci/rerun-security-concurrency.mjs)
and its GitHub Actions surface is
[`.github/workflows/security-concurrency-rerun.yml`](../.github/workflows/security-concurrency-rerun.yml).

Per invocation:

1. Attempt 1 runs the whole configured file list with the elevated timeout.
2. If any test fails, attempt 2+ reruns only the failing test IDs, waiting
   `backoffMs[attempt-1]` before each retry.
3. Every attempt writes a `{ ts, testId, outcome, attempt, runId, sha }`
   record to `.github/security-concurrency-flake-history.jsonl` via
   [`security-concurrency-flake-tracker.mjs`](../scripts/ci/security-concurrency-flake-tracker.mjs).
4. The history file is uploaded as a workflow artifact and downloaded on
   the next run, giving us a rolling record without a database.

Exit codes: `0` = eventually green, `3` = failed every attempt.

## Flake-frequency gate (before quarantining)

We do NOT quarantine on the first CI red anymore. Quarantine decisions
now require historical evidence:

| State | Definition (in `quarantineThresholds`) | Action |
| --- | --- | --- |
| `STABLE` | `< observeAfterFailures` failed runs in window | Do nothing. Treat single red as a real regression to investigate. |
| `OBSERVE` | `≥ observeAfterFailures` but below the quarantine bar | Investigate + let the recorder keep collecting data. Do NOT add to `flaky-tests.json` yet. |
| `RECOMMEND_QUARANTINE` | `≥ recommendQuarantineAfterFailures` failed runs **and** `failureRate ≥ recommendQuarantineMinFailureRate` in window | Only now is a time-boxed quarantine entry (≤30d, with issue link) justified. |

Defaults: 14-day window, `observe ≥ 2`, `recommend ≥ 4` failed runs and
≥25% failure rate. Tune them in
`.github/security-concurrency-tests.json`.

The tracker's per-test recommendation is printed at the end of every
security-concurrency workflow run and to `GITHUB_STEP_SUMMARY`, and is
persisted to `flake-report.json` as an artifact.

## Local commands

```sh
# See the current recommendation table
node scripts/ci/security-concurrency-flake-tracker.mjs report \
  --path=.github/security-concurrency-flake-history.jsonl

# Programmatic decision for one test id (STABLE | OBSERVE | RECOMMEND_QUARANTINE)
node scripts/ci/security-concurrency-flake-tracker.mjs decide \
  --path=.github/security-concurrency-flake-history.jsonl \
  --test-id="<full vitest id>"

# Run the concurrency suite locally with the same strategy CI uses
node scripts/ci/rerun-security-concurrency.mjs
```

## PR checklist for a new quarantine entry

Before adding anything to `.github/flaky-tests.json` for a
security-concurrency test, confirm all of:

- [ ] Tracker recommendation is `RECOMMEND_QUARANTINE` for the exact
      test id, based on ≥14d of history.
- [ ] The failing case is not a data-integrity or authorization check
      whose flake could mask a real leak — those get a real fix, not a
      quarantine, regardless of frequency.
- [ ] Entry has `expires` ≤ 30 days from today and links to a tracking
      issue that names the underlying cold-start / timeout root cause.
- [ ] The dedicated workflow's most recent run URL is referenced in the
      PR description so reviewers can see the frequency evidence.
