# Project rules

- Lockfiles (package-lock.json and bun.lock) reference only public registry URLs; after installs run `node scripts/ci/check-npm-lockfile-hygiene.mjs --fix-urls`, because the sandbox cache writes private URLs and CI fails on them.
- New workflows run `./.github/actions/stale-commit-check` right after checkout and are listed in `stale-result-check.yml`, so results from an outdated commit are marked STALE instead of mistaken for the latest code.
- Commit-triggered workflows set `concurrency: {group: <workflow>-${{ github.ref }}, cancel-in-progress: true}`, so a newer push cancels the older run; stale-result-check skips cancelled runs and only marks completed ones.
