# Dependency sync

- [ ] Align the CodeQL release manifest and all workflow pins with verified v4.39.1; run the version gate and regression tests.

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