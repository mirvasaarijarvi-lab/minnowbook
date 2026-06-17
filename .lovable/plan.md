# Per-Resource Operational Hours

## What you'll see

In the resource edit dialog (Muokkaa resurssia), under a new "Working hours" section:

1. **Weekly schedule** — A row for each day Mon to Sun with:
   - A toggle "Working / Closed"
   - "From" and "To" time pickers (only enabled when working)
   - An optional "Same hours every day" shortcut

2. **Occasional working slots** — Below the weekly schedule, a section for sporadic workers:
   - "Add slot" button opens a small picker: date + start time + end time
   - Each saved slot shows as a chip "Tue 12 Aug, 10:00 to 14:00" with a delete icon
   - Slots are additive: they make the resource bookable on dates/times outside the weekly schedule (or on days marked Closed)

A resource can use either pattern or both. If both weekly schedule and occasional slots are empty, the resource falls back to the site/tenant opening hours (current behavior).

The public booking page and calendar will respect these hours for any resource, not just restaurant tables.

## Why two patterns

- A regular massage therapist who works Tue-Sat 10 to 18 uses only the weekly schedule.
- A visiting physiotherapist who works two Saturdays a month uses only the occasional slots.
- A resource that's normally Mon-Fri but opens for an occasional Sunday workshop uses both.

## Scope

- Extends to all resource types (wellness, custom, hotel, etc.), not just restaurant tables.
- Available only in the **edit** dialog (after the resource is saved once). The create dialog will show "Save the resource first, then set working hours" - this matches the existing pattern.
- Hours are validated to be on the same day, end > start, and 15 min steps.

## Technical details

**Reused (already exists):**
- `resource_opening_hours` table and `ResourceOpeningHoursEditor` component — currently gated to `resource_type === "restaurant"`. Will be opened to all types and re-skinned to put the toggle on the left of each row.

**New:**
- `resource_availability_slots` table:
  - `resource_id`, `tenant_id`, `slot_date` (date), `start_time` (time), `end_time` (time), `note` (text, optional)
  - RLS: tenant members read/write their own; anon SELECT for active tenants (so public booking can read).
  - GRANT block as required.
  - Trigger: validate `end_time > start_time`.
- `ResourceOccasionalSlotsEditor` component, rendered under the weekly editor.
- Public booking + calendar availability resolver updated: a time is bookable if (weekly schedule allows it) OR (an occasional slot covers it). Existing blocks still override both.

**Files to touch:**
- `supabase/migrations/<new>.sql` - new table, RLS, GRANT, trigger.
- `src/components/dashboard/ResourceManagement.tsx` - drop the `=== "restaurant"` gate, mount the new editor.
- `src/components/dashboard/ResourceOpeningHoursEditor.tsx` - minor copy/layout tweak so the day-toggle reads clearly for non-restaurant resources.
- `src/components/dashboard/ResourceOccasionalSlotsEditor.tsx` - new component.
- `src/pages/PublicBooking.tsx` + availability helpers - merge occasional slots into the bookable-window calculation.
- i18n keys in EN / FI / SV for the new labels.
- Tests: RLS manifest test (`tenant-table-manifest.test.ts`) + cross-tenant RLS test get the new table added.

## Out of scope (ask if you want them later)

- Recurring exceptions (e.g. "every 2nd Saturday") - handled today by adding multiple occasional slots.
- Per-slot pricing overrides.
- Staff/user assignment to slots (the slot belongs to the resource, not a person).
