# Safe dependency update workflow

Bun is the local source of truth (`bun.lock`), but external pipelines and the
dependency-audit gate run `npm ci`, so `package-lock.json` must stay committed
and byte-identical to what npm would regenerate. This document describes the
only supported way to change dependencies.

## 1. Change the dependency

```bash
bun add <pkg>@<version>          # or: bun remove <pkg>
```

Never hand-edit `package.json` version ranges without re-running the steps
below: the two lock files fall out of step and the "Lockfile sync (npm)" gate
fails.

## 2. Regenerate `package-lock.json` without running scripts

```bash
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
bun install
```

* `--package-lock-only` resolves the graph and rewrites the lock file only, it
  never installs into `node_modules` and never executes package lifecycle
  scripts (this is the supply-chain safety property: a malicious postinstall
  cannot run during a routine lockfile refresh).
* `--ignore-scripts` keeps that guarantee even if npm would otherwise run
  prepare/postinstall hooks for the workspace.
* `--no-audit --no-fund` keeps output deterministic and avoids network calls
  that are unrelated to resolution.
* The trailing `bun install` re-syncs `bun.lock` so both lock files resolve the
  same versions.

## 3. Validate that resolved URLs point at the public registry

Some build environments proxy npm through a private mirror. If that mirror's
hostname leaks into `resolved` fields, CI regenerates a different file on every
run and the sync gate can never pass. Validate before committing:

```bash
bun run check:lockfile:npm       # specifier sync + public registry URL check
bun run check:lockfile           # bun.lock vs package.json vs package-lock.json
```

Only these hosts are allowed in `resolved` fields:

* `registry.npmjs.org`
* `codeload.github.com` (git/tarball dependencies)

If the check reports a private host, regenerate with the public registry:

```bash
npm install --package-lock-only --ignore-scripts --no-audit --no-fund \
  --registry=https://registry.npmjs.org
```

## 4. Verify, then commit both lock files

```bash
bun install --frozen-lockfile --ignore-scripts
bunx tsgo --noEmit
bun run lint
bun run test
node scripts/generate-sbom.mjs
bunx vite build
```

Commit `package.json`, `bun.lock`, `package-lock.json` and the regenerated SBOM
together in one change. A commit that updates only one lock file will fail CI.

## Automated enforcement

* `scripts/ci/check-npm-lockfile-hygiene.mjs` (`bun run check:lockfile:npm`)
  fails when the manifest and `package-lock.json` declare different ranges, or
  when any `resolved` URL points outside the public registry. It runs in the
  "Lockfile sync (npm)" workflow before the regenerate step, so the failure
  message names the actual cause instead of showing a large diff.
* `scripts/ci/check-npm-lockfile-hygiene.test.ts` covers both failure classes
  and asserts the committed files are currently clean.
* `scripts/ci/preflight-manifest-drift.mjs` (`bun run check:lockfile`) compares
  `package.json` against both lock files before any network install.

## Notes on specific dependencies

* Recharts major upgrades are deliberate (Dependabot ignores them); update both
  lock files and re-check the dashboard tooltips.
* `@tanstack/*` router/start packages must move together, and require the
  current major of the validation library (`zod` 4.x) because
  `@tanstack/start-plugin-core` depends on it.
* `react-router` is no longer a dependency: the app routes entirely through
  `@tanstack/react-router`. Do not reintroduce it; the removed pin and override
  existed only to hold back its open-redirect advisories.

## GitHub Action versions

Reusable actions are pinned in one place: `.github/action-versions.json`. Each
entry holds an immutable commit SHA plus the release tag that SHA belongs to.

`scripts/ci/check-action-versions.mjs` runs as the first step of the CI
pre-build gate (`.github/workflows/ci.yml`, job `schema-gate`) and fails the run
on:

- mutable refs (`@main`, `@master`, `@v5`, or no ref at all)
- drift from the manifest pin
- the same action pinned to two different commits in different jobs or
  workflows (this is the mismatch that previously broke the CodeQL wrap-up step:
  `init`/`analyze` on v4.38.1 while `upload-sarif` was still on v4.38.0)
- a version comment at or below the deprecated major recorded for that action
- a SHA pin with no `# vX.Y.Z` comment, or an action missing from the manifest

To bump an action:

1. Edit its `sha` and `version` in `.github/action-versions.json`.
2. Run `bun run check:actions:fix` to rewrite every workflow reference.
3. Run `bun run check:actions` to verify, then commit the manifest and the
   workflow changes together.

Local verification: `bun run check:actions` and
`bunx vitest run scripts/ci/check-action-versions.test.ts`.
