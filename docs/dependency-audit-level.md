# Dependency audit threshold (`AUDIT_LEVEL`)

The [`Dependency audit`](../.github/workflows/dependency-audit.yml) workflow runs
a software composition analysis scan on every pull request and blocks merge when
any vulnerability at or above a configured severity threshold is found. That
threshold is `AUDIT_LEVEL`.

This document explains where the value comes from, how to change it, and how to
override it for a one off run.

## Allowed values

`AUDIT_LEVEL` must be one of:

- `low`
- `moderate`
- `high` (default)
- `critical`

The value is case sensitive (lowercase) and is validated by the workflow before
any audit runs. A typo (for example `High` or `med`) fails the job with a clear
error instead of silently relaxing the gate.

The threshold is inclusive: `high` means "fail on any high or critical
advisory, ignore moderate, low, and info".

## Where the value comes from

The workflow resolves `AUDIT_LEVEL` in this order, highest priority first:

1. **`workflow_dispatch` input `audit_level`** (manual one off override, see
   [Override for a one off run](#override-for-a-one-off-run))
2. **Repository or environment variable `AUDIT_LEVEL`** (long lived project
   default, set in the GitHub UI, no code change required)
3. **Hardcoded fallback `high`**

The resolved value is also embedded in the SARIF metadata uploaded to GitHub
code scanning, written to the PR comment, and surfaced as the title of the
dedicated "Dependency audit (AUDIT_LEVEL=...)" check run, so reviewers can see
which gate level was applied.

## Set the project default

Use a repository (or environment) variable so the gate level can be ratcheted
up or down without editing the workflow file.

1. Go to **Settings, Secrets and variables, Actions**.
2. Open the **Variables** tab.
3. Click **New repository variable**.
4. Name: `AUDIT_LEVEL`. Value: `low`, `moderate`, `high`, or `critical`.
5. Save.

Subsequent workflow runs (PR, push to `main`, scheduled, manual) pick up the
new value automatically.

### When to ratchet up or down

- Start at `high`. This catches the advisories that matter most without
  drowning the team in noise from transient moderate advisories.
- Move to `moderate` once the project has been at zero high plus critical
  findings for a sustained period. This locks in the improvement.
- Temporarily relax to `critical` when a known vulnerable transitive ships a
  fix in N days and there is no safe pin available. Pair this with a tracking
  issue and revert as soon as the fix lands. Prefer the per advisory
  allowlist (see below) over relaxing the global threshold.

## Override for a one off run

To rerun the audit at a different threshold without changing the project
default, trigger the workflow manually:

1. Open **Actions, Dependency audit**.
2. Click **Run workflow**.
3. Choose the branch.
4. Pick a value from the **Minimum severity that fails the job** dropdown
   (`low`, `moderate`, `high`, or `critical`). Leave it blank to use the
   project default.
5. Click **Run workflow**.

This override only applies to that single run. The repository variable is not
changed.

### CLI examples

The same override is available via the GitHub CLI:

```bash
# Use the project default (repo variable, or 'high' if unset)
gh workflow run "Dependency audit"

# One off override at moderate
gh workflow run "Dependency audit" -f audit_level=moderate

# One off override at critical (least strict)
gh workflow run "Dependency audit" -f audit_level=critical

# Watch the run that just got queued
gh run watch
```

## Waive a single advisory instead of lowering the threshold

If a single advisory is forcing you to consider lowering `AUDIT_LEVEL`, prefer
adding a time boxed entry to
[`.github/dependency-audit-allowlist.json`](../.github/dependency-audit-allowlist.json)
instead. The allowlist supports matching by npm advisory id, GHSA id, or CVE
id, and every entry must carry an `expires` date (`YYYY-MM-DD`, UTC) and a
`reason`. Expired entries automatically stop waiving the advisory and surface
as warnings on the PR so they get cleaned up.

Example entry:

```json
{
  "entries": [
    {
      "id": "GHSA-xxxx-yyyy-zzzz",
      "expires": "2026-06-30",
      "reason": "Awaiting upstream fix in package@1.2.4, see issue #1234"
    }
  ]
}
```

This keeps the global gate strict while still letting you merge unrelated work.

## Reading the result on a PR

On every pull request, the workflow surfaces the gate result in three places:

- A **sticky PR comment** with the full severity breakdown, the list of
  blocking and waived advisories, and any expired allowlist entries.
- A **dedicated check run** in the Checks sidebar titled
  `Dependency audit (AUDIT_LEVEL=<level>)` whose subtitle reads, for example,
  `AUDIT_LEVEL=high, 3 blocking (critical=1, high=2), 1 waived, 0 expired`.
- **Code scanning alerts** in the Files changed tab and the Security tab,
  rendered from the SARIF upload (one entry per vulnerable package, stable
  rule id from the GitHub Advisory Database).

If you want to require the dedicated check on the default branch, add
`Dependency audit (AUDIT_LEVEL=<your level>)` to the required status checks
under **Settings, Branches, Branch protection rules**. Note that the check
name includes the resolved level, so changing `AUDIT_LEVEL` also changes the
required check name. For most teams the existing job level check
(`Dependency audit / dependency-audit`) is the more stable thing to require.
