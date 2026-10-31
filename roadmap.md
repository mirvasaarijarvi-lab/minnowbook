# Dependency sync

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