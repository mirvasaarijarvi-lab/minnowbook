# Bun version policy

CI installs Bun from a single source of truth so every job, on every
runner, gets byte-for-byte the same toolchain. Frozen-lockfile installs
are extremely sensitive to Bun minor/patch bumps, so this is treated as
a supply-chain pin, not a convenience.

## Where the version lives

| File | Consumed by | Purpose |
| ---- | ----------- | ------- |
| `.github/actions/setup-bun-with-diagnostics/bun-pin.env` | Every CI job (via the composite action) | Authoritative version **and** per-platform SHA-256 used to verify the installed binary. |
| `.bun-version` | `oven-sh/setup-bun`, local `bun` users, editors | Discoverability and local parity — running `bun install` locally uses the same version CI uses. |
| `package.json` → `packageManager` / `engines.bun` | Corepack, Renovate, IDE tooling, dependency dashboards | Machine-readable declaration so bots and contributors see the pin without spelunking workflows. |

All three MUST agree. The preflight workflow (see below) treats a mismatch
as a hard failure once we add a cross-check; for now keep them aligned by
hand when bumping.

## Current pin

`1.3.14`

## Bumping the pin

1. Pick a release from <https://github.com/oven-sh/bun/releases>.
2. Fetch the official checksums:
   ```bash
   curl -sSL \
     https://github.com/oven-sh/bun/releases/download/bun-v<VERSION>/SHASUMS256.txt
   ```
3. Update **all three** locations:
   - `.github/actions/setup-bun-with-diagnostics/bun-pin.env` (`BUN_VERSION` + every `BUN_SHA256_*`)
   - `.bun-version`
   - `package.json` (`packageManager` and `engines.bun`)
4. Run locally:
   ```bash
   bun install --frozen-lockfile
   bun run check:lockfile
   bun run test
   ```
5. Open the PR. The `bun-lockfile-preflight` workflow re-verifies the
   checksum on the runner.

## Drift guards (lockfile, not toolchain)

Two complementary checks run on every PR:

1. **Static preflight** — `bun run check:lockfile`
   Pure-Node diff between `package.json` and `bun.lock` /
   `package-lock.json`. Wired into jobs via the
   `.github/actions/verify-bun-lockfile-sync` composite step, and
   intended to run **before** any `bun install --frozen-lockfile`
   step so failures land with an actionable report instead of bun's
   terse "lockfile had changes" line.

2. **Live preflight** — `.github/workflows/bun-lockfile-preflight.yml`
   Runs the real `bun install --frozen-lockfile`; on failure it
   regenerates the lockfile with `--save-text-lockfile` and prints
   the diff. Catches the rarer cases the static check can't see
   (transitive resolution changes, registry shifts).

If both pass, downstream `bun install --frozen-lockfile` steps in
other workflows are guaranteed to succeed.

## Self-healing locally

```bash
bun run lock:heal        # regenerate bun.lock, print diff + commit hint
bun run lock:heal:check  # report drift without writing
```
