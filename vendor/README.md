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

## Open risk and closure criteria

Status as of November 13, 2026: mitigated locally, awaiting an official fix.
The npm registry still lists 4.0.7 as latest, not a patched release.
AIKIDO-2026-928674 remains an open dependency risk, not a resolved upstream
vulnerability. The affected paths include development/build/test tooling;
the local guard disables repeated extglobs across all installed copies.
Registry-only scanners cannot assess the local tarball, so an empty registry
scan is not evidence that this advisory has been resolved. The available
Lovable scan has no matching persisted finding; the external Aikido finding
has not been closed or suppressed.

When an official fix becomes available:

1. Verify the advisory or upstream security notes explicitly cover this
   single-branch repeated-extglob flaw, not merely a newer version number.
2. Replace the local dependency and override with that verified patched
   release and regenerate both lockfiles and SBOMs.
3. Adapt the regression tests to verify safe matching, not necessarily
   SyntaxError refusal; timeout-bounded attack probes, normal matching,
   every resolved copy and fresh installs must all pass.
4. Run dependency audits and request a fresh Aikido scan. Close only the
   matching finding once that scan confirms the vulnerable graph is gone.

This is a tracked follow-up, not a background upgrade or monitoring job.

Repack after changes with:

```sh
npm pack ./vendor/picomatch --pack-destination /tmp/picomatch-review --ignore-scripts
cp /tmp/picomatch-review/picomatch-4.0.7-mimmobook.1.tgz vendor/
```

The root development dependency points to the committed tarball and the
`$picomatch` override binds every transitive instance to it. This avoids npm
resolving a relative file override inside each dependent package directory.
The security test checks lockfile integrity, installed nested copies,
source/archive equivalence, attack rejection in timeout-bounded processes,
and normal filename matching. Remove the local override only when an official
fixed release passes the same security and compatibility checks.
