
## Implementation Plan: 15 Features & Improvements

### Phase 1: Feature Additions
1. **Guest Portal** — Create a `/my-booking/:token` route with magic-link lookup. Add a `booking_tokens` table to map tokens to reservations. Guests can view details and cancel without logging in.
2. **Dashboard Analytics Charts** — Add Recharts-based trend charts (occupancy over time, revenue, peak hours) to the Reports panel using existing reservation data.
3. **Waitlist System** — Create a `waitlist` table. When a resource/slot is fully booked, show "Join waitlist" on the public booking page. Auto-notify via email when a slot opens.
4. **Export to CSV/PDF** — Add export buttons to Reservations and Reports panels. CSV via client-side generation, PDF via browser print/jsPDF.
5. **Google Calendar Sync** — Add iCal feed endpoint (Edge Function) that generates `.ics` format from reservations. Users can subscribe from Google Calendar.

### Phase 2: UX Improvements
6. **Onboarding Checklist** — Add a setup progress widget on Dashboard Overview showing completion % (has resource, has opening hours, has email template, etc.).
7. **Quick Actions FAB** — Floating action button on mobile for "New Reservation" with smooth animation.
8. **Dark Mode Toggle** — Add toggle in sidebar/settings using `next-themes` (already installed).
9. **Keyboard Shortcuts Help Modal** — Add `?` shortcut to show a modal listing all available keyboard shortcuts.

### Phase 3: Reliability & Security
10. **Rate Limiting on Login** — Add client-side throttle (max 5 attempts/minute) with countdown timer on the login page.
11. **Audit Log Viewer Filters** — Add filter controls (action type, date range, user) to the existing AuditLogPanel.
12. **Database Backup Reminder** — Surface a backup status indicator in the HealthCheckPanel.

### Phase 4: Business Value
13. **Public Reviews/Testimonials** — Create a `guest_reviews` table. Post-visit email with review link. Display on public booking page.
14. **Multi-language Public Booking** — Auto-detect browser language on the public booking page and apply i18n translations.
15. **Stripe Revenue Dashboard** — Add MRR and payment status cards to the Superadmin panel using existing Stripe integration.

### Approach
- Each feature will be implemented sequentially in the listed order
- Database migrations will be proposed before code changes
- Existing patterns (permissions, RLS, i18n, design tokens) will be followed throughout
