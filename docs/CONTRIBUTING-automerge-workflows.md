# Contributing: Auto-merge Workflows

This note covers the rules for any workflow under `.github/workflows/`
whose filename contains `dependabot` or `auto-merge`. These workflows
are enforced by `.github/workflows/workflow-security-regression.yml`,
which fails CI on any regression.

## Why `pull_request_target` is forbidden

Auto-merge workflows must use the `pull_request` trigger, never
`pull_request_target` (and never `workflow_run` or
`repository_dispatch`).

`pull_request_target` runs in the context of the **base** branch, with
a read/write `GITHUB_TOKEN` and access to repository secrets, even
when the PR comes from a fork. An attacker can open a PR that ships
malicious code in any file the workflow touches (a script, a config,
a dependency that gets installed) and that code then executes with
push, package-publish, and secret-read privileges. Combined with
auto-merge it gives a fork PR a path to silently land code on `main`.

`workflow_run` and `repository_dispatch` have the same blast radius
(they run from the default branch with full secrets) so they are
banned in the same class of workflow.

`pull_request` runs in the **fork's** context with a read-only token
and no secrets, which is the right default for code that has not yet
been reviewed. Dependabot PRs originate from in-repo branches, so the
default `GITHUB_TOKEN` is sufficient for `gh pr merge --auto`, label
edits, and approvals.

## Other rules enforced on auto-merge workflows

1. **Top-level `permissions: {}`**, with each job re-granting only
   the scopes it actually needs (typically `contents: write` and
   `pull-requests: write` for the merge job, nothing for any
   helpers).
2. **Pin third-party actions to commit SHAs**, with the human-readable
   tag in a comment on the same line. Tags are mutable.
3. **`actions/checkout` must set `with.persist-credentials: false`**.
   Without it, the `GITHUB_TOKEN` is left in the runner's git config
   and any later `run:` step (or compromised dependency) can `git
   push` using the job's elevated `contents: write` scope.
4. **Gate on the actor**: `if: github.actor == 'dependabot[bot]'` (or
   equivalent) so a human accidentally re-running the workflow on a
   different PR cannot trigger an auto-merge.

## Adding a new auto-merge workflow

The regression scanner discovers files by name, so:

1. Name the file so it contains `dependabot` or `auto-merge`
   (e.g. `auto-merge-renovate.yml`). The scanner will pick it up
   automatically, no code change to the regression workflow is
   required for the standard checks.
2. Verify the new file passes locally before opening the PR:
   ```bash
   # Forbidden triggers
   grep -nE '(^|[^A-Za-z0-9_-])(pull_request_target|workflow_run|repository_dispatch)([^A-Za-z0-9_-]|$)' \
     .github/workflows/<your-file>.yml && echo FAIL || echo OK

   # Unsafe checkout
   python3 -c "
   import yaml, sys
   doc = yaml.safe_load(open(sys.argv[1]))
   for jn, j in (doc.get('jobs') or {}).items():
       for s in j.get('steps') or []:
           if isinstance(s, dict) and str(s.get('uses','')).startswith('actions/checkout@'):
               assert (s.get('with') or {}).get('persist-credentials') is False, (jn, s.get('name'))
   print('checkout OK')
   " .github/workflows/<your-file>.yml
   ```
3. Open the PR. The `Workflow security regression` check will run
   automatically (it is path-filtered to `.github/workflows/**`).

## Adding a new check to the regression scanner

If you want to enforce a new rule (e.g. forbid a freshly disclosed
risky trigger, or require a new safety flag), edit
`.github/workflows/workflow-security-regression.yml`:

1. Add a new `Check N:` block in the `Scan auto-merge workflows for
   forbidden patterns` step. Follow the existing pattern: write
   findings to `/tmp/hits.txt`, emit a `::error file=...::` line
   that explains the fix in the message, increment `violations`.
2. For YAML structural checks (anything beyond a regex), extend the
   inline `python3 -` block. It already loads each candidate file
   with `yaml.safe_load` and walks `jobs[*].steps[*]`, so reuse that
   loop instead of adding a second parser.
3. Update the success line at the bottom of the step to mention the
   new rule, and update this document so the rationale is captured.
4. Run the smoke test from the section above against
   `.github/workflows/dependabot-auto-merge.yml` to confirm the
   hardened reference workflow still passes.

## Out-of-scope (intentionally not blocked)

- Workflows outside the `dependabot` / `auto-merge` filename pattern
  may use `pull_request_target` if they genuinely need it (e.g. a
  hypothetical fork-PR labeller). Those workflows must still be
  reviewed for the usual `pull_request_target` hygiene, but the
  regression scanner does not gate them.
- Inline YAML comments containing the forbidden tokens (e.g.
  `# do NOT use pull_request_target`) are stripped before scanning,
  so documentation comments do not trip the check.
