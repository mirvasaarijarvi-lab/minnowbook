# Picomatch local security mitigation

Upstream 4.0.7 has no published fix for AIKIDO-2026-928674. Removing the
TanStack devtools dependency alone leaves copies used by Vite, routing and
Vitest. This override preserves that stack without upgrading upstream.

Source: https://registry.npmjs.org/picomatch/-/picomatch-4.0.7.tgz
Upstream archive SHA-256:
`697b463be3cdbd9ffc8f4194fd5019a69ddf95875fb703d78b2b115cc9e740a8`
The upstream MIT license is retained in `picomatch/LICENSE`.

Local version `4.0.7-mimmobook.1` changes only the version and
`lib/parse.js`'s `extglobOpen`: `+(...)` and `*(...)` raise a SyntaxError
before generating regexes. This intentionally disables all repeated extglobs,
including plain single branches, nested forms and recursion opt-outs.
Ordinary stars, globstars, braces, classes and non-repeating extglobs remain.
This is a local mitigation, not an upstream patched release. Version-only
scanners may keep reporting it; do not suppress that finding automatically.

Repack after changes with:

```sh
npm pack ./vendor/picomatch --pack-destination /tmp/picomatch-review --ignore-scripts
cp /tmp/picomatch-review/picomatch-4.0.7-mimmobook.1.tgz vendor/
```

Both package managers override every picomatch instance to the committed
tarball. The security test checks lockfile integrity, installed nested copies,
source/archive equivalence, attack rejection in timeout-bounded processes,
and normal filename matching. Remove the local override only when an official
fixed release passes the same security and compatibility checks.