## Goal

Make occasional slot pickers and availability calculations honor a single, explicit timezone (resource override, otherwise tenant) instead of silently using the browser's local zone. Today, `tenant_settings.timezone` exists but is never read, resources have no timezone field at all, and pickers like `ResourceOccasionalSlotsEditor` use `new Date()` / `format()` in browser local time. That means a staff member on holiday in another country can accidentally create a "Tuesday 09:00" slot that lands on Monday for the tenant.

## Approach

1. Add a per-resource override; fall back to tenant; final fallback to `Europe/Helsinki` (project default for the Finland-based product).
2. Provide one tiny helper (`getEffectiveTimezone`, `tzNow`, `tzFormat`, `tzToday`, `tzDayOfWeek`) so every caller goes through the same code path. No `date-fns-tz` style date-math acrobatics in components.
3. Wire the helper into the places where local-time assumptions exist today and where they're about to be added: occasional slots editor, weekly opening-hours editor display, and the public booking availability resolver.
4. Surface the effective timezone in the UI (small caption next to the pickers) so staff in a different physical zone know what they're scheduling against.

## Scope

### Schema

- New migration: add `resources.timezone TEXT NULL` (IANA name, e.g. `Europe/Helsinki`). Null means "inherit tenant".
- No change to `tenant_settings.timezone` — it already exists.
- No change to `resource_availability_slots` — `slot_date` / `start_time` / `end_time` stay timezone-naive and are interpreted in the resource's effective timezone. This matches `resource_opening_hours` and avoids a destructive backfill.

### New helper: `src/lib/timezone.ts`

```ts
getEffectiveTimezone({ resourceTz, tenantTz }): string  // resource ?? tenant ?? "Europe/Helsinki"
tzToday(tz): string                                     // yyyy-MM-dd in tz
tzNow(tz): { date: string; time: string }               // for "is this slot in the past?" checks
tzFormat(iso, pattern, tz, locale): string              // wraps Intl
tzDayOfWeek(iso, tz): 0..6                              // Sunday=0, used by weekly hours
```

Implementation uses `Intl.DateTimeFormat` with `timeZone` option — no new dependency.

### Hook: `useEffectiveTimezone(resourceId?, tenantId)`

Reads `resources.timezone` and `tenant_settings_public.timezone` via React Query, returns the resolved IANA string + a `source: "resource" | "tenant" | "default"` flag.

### Files to edit

- `src/components/dashboard/ResourceOccasionalSlotsEditor.tsx`
  - Replace `new Date()` / `format(...)` with `tzToday` / `tzFormat`.
  - `past_date` validation uses `tzNow` so a slot at 23:30 in Helsinki isn't rejected as past for a user in California.
  - Render a small `text-[11px] text-muted-foreground`: "Times shown in {tz}" with a "change" link only when the resource has no override (links to a new per-resource timezone field in the resource form).
- `src/components/dashboard/ResourceManagement.tsx`
  - Add an optional Timezone select (IANA list via `Intl.supportedValuesOf("timeZone")`) on the resource form. Placeholder = "Inherit tenant ({tenantTz})".
  - Persist `resources.timezone`.
- `src/components/dashboard/ResourceOpeningHoursEditor.tsx`
  - Use `tzFormat` for any date labels and `tzDayOfWeek` when mapping "today" to a weekday row.
- `src/pages/PublicBooking.tsx` (availability resolver section that reads `resource_opening_hours` and blocked slots)
  - Compute "today / current weekday / current time" via `getEffectiveTimezone` for the resource being booked, not `new Date()`.
  - Same for the day labels shown to the guest.
- `src/i18n/translations.ts`
  - Add keys: `timezone.label`, `timezone.inheritTenant`, `timezone.shownIn`, `timezone.fallback` in EN / FI / SV.

### Out of scope (call out, don't do)

- Wiring `resource_availability_slots` into the public booking availability resolver — still the larger separate pass from the previous turn. This change makes the timezone story correct so that pass can land cleanly.
- Per-site timezone (sites table). If a customer asks, we can layer it between resource and tenant later; the helper signature is already shaped for that.
- Migrating historic `resource_opening_hours` rows — they remain interpreted in the (new) effective timezone, which for existing single-site Finnish tenants is identical to today's behavior.

### Tests

- Add `src/lib/__tests__/timezone.test.ts`: covers `tzToday` across DST boundary, `tzDayOfWeek` for `Pacific/Auckland` vs `Europe/Helsinki`, and "Inherit tenant" fallback.
- Update `src/test/security/tenant-table-manifest.test.ts` only if column addition affects manifest snapshot (it won't — manifest tracks tables, not columns).

## Risk & rollback

- Migration only adds a nullable column, safe to roll forward and back.
- All callers default to current behavior when `timezone` is null on both resource and tenant (Helsinki), so no existing tenant sees a behavior change.
