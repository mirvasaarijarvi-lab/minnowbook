# Fix: Wellness reservation + resource-driven calendars

## Problems found

1. **Calendar sections are hardcoded** to Hotel / Venue / Restaurant in `src/components/dashboard/CalendarView.tsx` (`SECTIONS` const). A wellness tenant has no hotel/venue/restaurant resources, so it still sees three empty calendars and never sees its actual resource types (e.g. massage, wellness, custom).

2. **"Create Reservation" button stays disabled on the wellness site.** In `ManualReservationDialog.tsx`:
   - When `allowedTypes.length === 1`, `reservation_type` is auto-set, so the type dropdown is hidden. Good.
   - But for a wellness tenant whose single allowed type is `"custom"` (or any non hotel/venue/restaurant), the dialog renders no service / sub-service picker unless a resource is selected, and the validation (`isValid`) does not require a resource. The button looks greyed because the primary button uses muted color in this state, and submitting still tries to insert a row with empty `start_time` and no resource link, which the DB validation trigger then rejects silently for "custom" type.
   - Also: when the type is "custom" and the tenant has only one resource, the resource is not auto-selected, so the price stays at the resource default and submission can fail server-side on capacity/site resolution.

## Fix plan

### A. Resource-driven calendars (`CalendarView.tsx`)
- Replace the static `SECTIONS` constant with a query that loads the tenant's distinct active `resource_type` values from `resources` (scoped by the current site selection via `useUserSites` / `useSiteContext`).
- Build one `<CalendarSection>` per distinct type returned. Pass `reservationTypes` and `resourceTypes` as `[type]` (keeping the existing "hotel + guesthouse" grouping as a special case).
- Title each section with `useResourceTypeLabel().typeLabel(type)`, falling back to the resource's `custom_type_label` for custom types.
- Render nothing (with a friendly empty state pointing to Resource Management) when the tenant has no active resources.

### B. Wellness / custom reservation creation (`ManualReservationDialog.tsx`)
- When `form.reservation_type` is set and `resources.length === 1`, auto-select that resource into `selectedResourceId`.
- Tighten `isValid`: require `selectedResourceId` whenever `resources.length > 0`, so the button enables only when a resource is chosen and clearly disables otherwise (also add a small helper text under the resource field when empty).
- For "custom" type, ensure the insert payload includes `resource_id` and `resource_type` derived from the selected resource (not from `form.reservation_type`), and default `start_time` to the entered "Preferred time" or `"12:00"` if blank, matching the public booking edge function.
- Surface server errors from the insert via `FunctionsHttpError`-style decoding already used elsewhere, so the user sees the real reason instead of a silent no-op.

### C. Verification I will run after the edits
- Browser-test the wellness tenant: open New Reservation, confirm the resource auto-selects, fill the form, submit, and confirm the new row appears in the list.
- Confirm the Calendar tab shows only the sections matching that tenant's resources (no empty Hotel/Venue/Restaurant cards).
- Spot-check a multi-type tenant (hotel + restaurant) to confirm both sections still render and group correctly.

## Out of scope
- No schema changes, no edge function changes, no styling redesign.
- No changes to public booking flow (already resource-driven).

Approve and I'll implement A and B, then run the browser verification in C.
