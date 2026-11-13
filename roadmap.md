# Dependency sync

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