# Project rules

- Lockfiles (package-lock.json and bun.lock) reference only public registry URLs; after installs run `node scripts/ci/check-npm-lockfile-hygiene.mjs --fix-urls`, because the sandbox cache writes private URLs and CI fails on them.
