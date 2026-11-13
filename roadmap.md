# Dependency sync

- [ ] Repair PR #158 by retaining React Query 5.104.2, preserving other intended updates and current main fixes, regenerating locks/SBOMs, and rerunning dashboard and dependency checks. No PR merging or closing.

- [x] Resolve PR #159 against main 8dc9490. Final head b7a0137 is conflict-free and zero commits behind; only seven dependency/lock/SBOM files changed. Both locks resolve postgres 4.1.1 within the intended ^4.1.0 range; safety pins and open picomatch risk preserved. Regeneration, manifest agreement, public URL hygiene and security floors passed on GitHub. Fresh PR checks started and missing build/security summary workflows dispatched; no merging or closing PRs.
- [ ] Confirm PR #159's final required-check results. At 18:30 UTC, 32 passed, 12 running, 7 queued and 6 skipped, none failed; RLS/CORS summary is produced after its prerequisite jobs. Waiting on GitHub completion.

- [ ] Complete final-commit regression verification for all open PRs. PR #160 contains main e78d4b7, has zero changed files, and 44 successful checks with 6 skipped and 6 pending at 18:15 UTC. Current main public page and signed-in dashboard render without page errors, not a substitute for PR browser tests. PR #158 still proposes known dashboard-breaking React Query 5.106.1 after ignoring 5.107.x; requested full dependency ignore and updated its branch with main, but exclusion remains unverified. PR #159 recreation requested because conflict refresh has not completed. Wait for corrected heads and full dashboard/public/function checks; nothing merged or closed.

- [x] Refresh PR #160 with main 3db1958; new head 3df24e8 verified ahead with zero commits behind. No PR merged or closed.
- [ ] Complete corrected dependency selection for #158. It regenerated but substituted known-broken 5.106.1, so full query ignore requested; main update accepted at 18:15 UTC. PR #159 conflict repair and main refresh completed separately above. Waiting on Dependabot before verifying #158's corrected head and fresh checks.

- [x] Synchronize the config package's npm lock from 2.27.0 to the declared 2.27.1 and refresh both SBOMs. Manifest drift, public-registry hygiene, security floors and 20 regression tests pass. Production scan has no known registry findings; local picomatch risk remains open and unassessed by that scan. GitHub must test the refreshed files after automatic sync; no PR merged or closed.

- [x] Repair local-stack startup cleanup to inspect Docker HostPort mappings instead of the publish filter, before the first attempt and each retry. Port conflict 54322 confirmed in all three failed attempts; 22 regressions, action gate, shell syntax, formatting and lint pass. No PR merged or closed.
- [x] Confirm multipart GitHub rerun completes. Attempt 2 of run 43447704773 passed startup, local live tests and report upload at 18:02:23 UTC on November 13. The historical rerun used its original commit, not the new cleanup repair; no PR merged or closed.

- [x] Repair PR #156 browser crash caused by query releases 5.106.1 and 5.107.1. Pinned verified 5.104.2 with both locks and SBOMs refreshed. Nine offer browser flows and 254 targeted regressions pass; security floors, lock hygiene and action gate pass, moderate production audit has zero blockers. Fresh GitHub checks still required; no PR merged or closed.

- [x] Review all eight open repository PRs and create combined replacement draft PR #156 on latest main, preserving November 13 fixes. Reconstructed 26 dependency updates, refreshed both locks and SBOM copies, verified action pins, 58 targeted tests and 749 live checks. Originals remain open; nothing merged.
- [ ] Confirm every GitHub check on combined PR #156's latest commit passes before marking ready or closing originals. Waiting on external CI completion; local checks are not a substitute for full CI.
- [x] Fix PR #156 subscription header scanning and integrity-checked local tarball version detection; align CI to Node 22/24 because patched jsdom/undici cannot support Node 20 without downgrades. Preserved local mitigation, upstream risk, locks and SBOMs. Reran GitHub checks on 348e580, local floor/action/hygiene gates, 163 targeted tests, 171 mapping tests, 749 live checks and 2,827 unit tests. The isolated unit run excluded only the git-metadata scan, which GitHub still runs; no PR merged or closed.

- [ ] Resolve AIKIDO-2026-928674 with a verified official picomatch fix, then rerun attack/compatibility tests, refresh both locks and SBOMs, and confirm a fresh Aikido scan before closing. Blocked: npm latest is still unpatched 4.0.7 on November 13, 2026. Local mitigation retained; risk and closure criteria documented in vendor/README.md.

- [x] Remove all seven expired live-test quarantines without extending dates. Use shared bounded retries for redemption/cacheability probes, honor full numeric or HTTP-date cooldowns, and size burst budgets accordingly. All 749 affected live checks pass twice without test reruns; eight retry regressions plus four picomatch regressions and targeted lint pass. Exact quarantine gate now reports zero entries, errors and warnings.

- [x] Mitigate picomatch with a licensed local 4.0.7 source patch refusing repeated extglobs, no upstream upgrade. Both locks and SBOMs synchronized; 24 security regressions, targeted lint, clean npm ci, frozen Bun install, stable regeneration and moderate audit gate pass. Live preview renders with zero runtime errors. Registry scanner cannot assess the local tarball; finding not suppressed. Full-project lint exceeded the 600-second sandbox limit, so its result remains unverified.

# Subscription checkout and recovery review

- [x] Fix checkout and portal failure handling, same-tab recovery, provider timeouts and repeat-checkout protection.
- [x] Fix business-bound lookup, Basil billing dates, checked persistence and expired sample restoration; preserve active sample access and fail closed on account checks.
- [x] Verify 36 targeted regressions, five billing-role tests, deployment checks, lint and signed-in phone/desktop failure controls. Simulated portal retry, same-tab handoff and successful refresh pass without charges. Real paid restoration remains unverified because the available account has no linked Stripe subscription; the unmocked retry displayed verification failure, not a false success.

- [x] Fix the reported jsdom cross-origin credential leak with 30.1.3, synchronize both lockfiles and SBOMs, and verify redirect security plus affected UI tests. All 22 selected tests, targeted lint, manifest drift and registry hygiene checks pass.

- [x] Fix Playwright booking checks to honor HTTP 429 cooldowns without skipping assertions, and honor the configured app URL in cross-booking. Eight retry regressions and all four live warmup/cross-booking checks pass. Browser confirms Analytics uses the real measurement ID with no secret placeholder; no Analytics change needed.

- [x] Align the Python setup manifest and both workflow references with verified v7.1.0; the exact action-version gate passes for 150 pins across 43 files and all 20 regression tests pass.

- [x] Align all three CodeQL manifest entries and five workflow references with verified v4.39.1. The exact action-version gate passes for 150 pins across 43 files; all 20 regression tests and targeted lint pass.

- [x] Fix shared Deno retries to honor Retry-After on 429 and preserve final assertions; remove unavailable Cloud credential instructions. Three retry regressions and the exact live booking check in CI missing-key mode pass; shell syntax checked. Production booking limits unchanged.

- [x] Add daily mobile staffing view with 48px time fields and 44px date controls. Signed-in checks confirmed time save/readback, restored the test edit, date navigation, worker filtering, no overflow at 360px/390px, optional full table and unchanged desktop table. Thirteen targeted tests pass.

- [x] Show subscription checkout failures with retry in EN/FI/SV and use same-tab handoff. Four regression tests pass; signed-in phone-sized browser checks with simulated provider replies confirmed missing-link feedback, same-plan retry, no popups and no runtime errors. No charge or real checkout session created.

- [x] Block incomplete payroll exports, wait for all pending time edits, reject failed saves, and show download progress. Nine payroll tests pass; signed-in checks confirmed missing-hour refusal, delayed-save waiting, saved hours readback and a real XLSX download. Test time restored.

- [x] Compact mobile booking locations and link validation errors to fields with focus and scroll movement; four booking tests and live mobile/desktop checks pass.

- [x] Fix the two reported glob and minimatch advisories with versions 14.0.3 and 11.0.3; both lockfiles synchronized, SBOMs regenerated, moderate audit gate has zero blockers, and all 19 targeted tests pass.

- [x] Fix both reported seroval injection advisories with compatible version 1.6.11; both lockfiles and SBOMs refreshed, audit gate has zero blocking findings, and all 15 security and lockfile regression tests pass.

- [x] Correct cleanup-test formatting reported by Test CI: full lint passes and both regression tests pass.

- [x] Repair the post-email-install Bun lockfile rewrite: normalized two email-package URLs without version changes; Bun 1.3.14 with the public registry and npm 11.21.1 regenerate unchanged, manifest and hygiene checks pass, and all 13 lockfile hygiene tests pass.
- [x] Apply the seven updates shown in PR #129 and regenerate both lockfiles.
- [x] Check lockfile stability, hygiene, security floors, and targeted tests; regenerate SBOMs.
- [x] Reproduce the Dependabot refresh npm edgesOut crash and verify a pinned npm fixes it.
- [x] Apply the verified npm pin to refresh and related sync/audit checks; validate workflow safety.

# Scheduled job pressure

- [x] Discard only the old booking-email backlog and preserve account messages: 3,280 removed through the existing deletion RPC, both queues verified empty.
- [x] Verify future email delivery: update published, test email received by the owner.
- [x] Dashboard delivery warning ignores reserved test addresses (all 30 recent failures were test bookings); email log rows kept.

- [x] Identify safe cadence reductions without breaking required delivery and retention timing.
- [x] Reduce disabled test-cleanup checks to weekly and verify live schedules; preserve delivery-critical jobs.
- [x] Identify remaining email-queue pressure: 3,280 unread messages and recent processor calls rejected with 401; credential recovery is a separate repair, not a cadence change.