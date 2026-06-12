# GDPR Compliance Gap Closure Plan

You already have a `Privacy` page and a basic `CookieConsent` component. The seven gaps below can be closed in three focused phases. Phase 1 is documentation-only (fast). Phase 2 upgrades cookie consent. Phase 3 adds user-facing rights (export + delete), which is the heaviest piece.

## Phase 1 — Legal/policy pages (low effort, high impact)

Add four new static pages (EN/FI/SV) linked from the marketing footer and Privacy page.

1. **Retention Schedule** — `/legal/retention`
   Table of data categories and how long MimmoBook keeps them:
   - Reservations: active for tenant lifetime, archived after 30 days post-event, permanently deleted after 400 days (matches existing data archival memory).
   - Audit log: 90 days (matches `cleanup_old_audit_logs`).
   - Booking validation log: 30 days.
   - Storage rejection events: 7 days; resolved alerts: 90 days.
   - Email send log / suppressions / unsubscribe tokens: TTL per existing email infra.
   - Account data: until account deletion + 30-day cancellation window.
   - Backups: 30 days rolling.

2. **Processor Inventory (Subprocessors)** — `/legal/subprocessors`
   List with purpose, data categories, region:
   - Supabase (Lovable Cloud) — DB, auth, storage, edge functions — EU.
   - Resend — transactional + marketing email.
   - Stripe — payments.
   - Google (Search Console, Analytics, Tag Manager) — analytics/SEO.
   - Lovable AI Gateway — AI features.

3. **Data Processing Agreement (DPA)** — `/legal/dpa`
   Standard controller↔processor DPA template covering Art. 28 GDPR: scope, duration, subject matter, processor obligations, subprocessor flow-down, SCCs reference, audit rights, breach notification, return/deletion on termination. Downloadable PDF version.

4. **Records of Processing Activities (RoPA)** — internal markdown at `docs/ropa.md`
   Per Art. 30 GDPR: processing activity, legal basis, data subjects, data categories, recipients, transfers, retention, technical/organisational measures. Not public, but available to DPA reviewers. Optional public summary on `/legal/processing`.

## Phase 2 — Cookie consent upgrade

Replace the current single-button banner with a category-based consent manager:

- Categories: **Strictly necessary** (always on), **Analytics** (GA4, GTM), **Marketing** (none today, reserved).
- Store consent in `localStorage` (`mimmobook-cookie-consent` JSON with version + timestamp + categories).
- Gate GA4 + GTM initialisation on `analytics === true`; default DENIED before consent (Google Consent Mode v2: `ad_storage`, `analytics_storage`, `ad_user_data`, `ad_personalization`).
- "Manage cookies" link in `MarketingFooter` that reopens the modal so users can withdraw consent.
- 12-month re-consent prompt.

## Phase 3 — User rights self-service

Add a new "Privacy & Data" tab in `/settings/profile` (visible to every authenticated user, not just tenant owners).

### 3a. Data export (Art. 15 + 20)
- Button: **Download my data**.
- New Edge Function `export-user-data` (`verify_jwt = false`, validates JWT in code):
  - Reads the caller's `auth.uid()`.
  - Aggregates: profile, tenant memberships, reservations the user created, audit log entries authored, login history, notifications, support requests, beta feedback.
  - Returns a single ZIP containing JSON files + a human-readable `README.txt`.
- Rate-limited (1 export per 24h per user) via `redemption_idempotency`-style table or a new `data_export_requests` table.
- Tenant owners additionally see **Export tenant data** (CSV per table) reusing existing CSV export infrastructure.

### 3b. Self-service account deletion (Art. 17)
- Button: **Delete my account** with a typed-confirmation modal ("type DELETE to confirm").
- New Edge Function `request-account-deletion`:
  - If the user is the sole **owner** of any tenant with active members or future reservations, block deletion and instruct them to transfer ownership or close the tenant first.
  - Otherwise mark `auth.users.deleted_at` (soft) and insert into a new `pending_account_deletions` table with `purge_after = now() + 30 days` (matches the 30-day cancellation window already documented).
  - Send confirmation email with a "Cancel deletion" link valid for 30 days.
- New cron job `purge-deleted-accounts` runs daily:
  - Hard-deletes `auth.users` row (cascades to `tenant_users`, profile, etc.).
  - Anonymises historic reservations the user authored (set `created_by = NULL`, scrub `guest_name`/`guest_email` where the user was also the guest).
- Audit-logged via existing `audit_log_trigger`.

## Technical details

- New tables (migration):
  - `public.pending_account_deletions (user_id uuid pk, requested_at, purge_after, cancel_token text)` with GRANTs to `authenticated` (own row only) and `service_role`; RLS policy `user_id = auth.uid()`.
  - `public.data_export_requests (id, user_id, created_at)` for rate limiting; same grant pattern.
- Cron via `pg_cron` + `pg_net` calling the purge function daily at 03:00 UTC.
- All new translations added to EN/FI/SV in `src/i18n/translations.ts`.
- Footer additions in `MarketingHeader`/`MarketingFooter`: Retention, Subprocessors, DPA, Manage cookies.
- No em/en-dashes in any copy (per project convention).

## Suggested order of delivery

1. Phase 1 pages + footer links (1 shipment, no backend).
2. Phase 2 cookie consent upgrade (1 shipment, frontend + GA gating).
3. Phase 3a data export (backend + UI).
4. Phase 3b account deletion + cron (backend + UI).

Reply with which phase(s) to start with, or "all" to proceed top to bottom.
