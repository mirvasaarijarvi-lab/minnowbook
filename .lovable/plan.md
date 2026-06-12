## Goal

Add **Wellness Services** as a first-class resource type so hairdressers, makeup artists, masseurs, etc. can publish a tickable services menu and accept time-slot bookings (no payments).

## What the customer sees

On the public booking page, after picking a wellness resource:
- A checkbox list of services (name + price + duration in minutes).
- Ticking one or more services automatically sums the total duration and the booking length snaps to the nearest 5-minute interval (capped at 8 h).
- "Total: 1 h 35 min, 65 €" summary shown above the time picker so the customer knows what slot length to look for.
- Money is informational only: no payment, no Stripe call, identical confirmation email flow as today.

## What the operator sees

In **Dashboard > Resources**:
- The "Tyyppi" dropdown gains a new option: **Hyvinvointipalvelut / Wellness services / Friskvårdstjänster** (between "Hotelli" and "Lisää oma").
- When Wellness is selected, the form swaps in a **Services menu editor** (reuses the existing `sub_services` pattern that "Custom" already uses):
  - Per row: Name, Price (€, optional), **Duration** (number input restricted to 5-min increments, 5 to 480), drag-to-reorder, delete.
  - "Add service" button.
  - Helper text: "Customers can tick one or more of these when booking."
- A new dashboard panel (or existing booking detail dialog section) shows which services the customer ticked on each reservation.

## Technical details

### Database (single migration)

- Extend `resources.sub_services` JSONB items with an optional `duration_min: int` field (5 to 480, multiple of 5). Already-stored items without the field stay valid.
- No new table needed. `reservations.selected_sub_services` already exists for the tick selections.
- Add a server-side validation trigger on `resources` that, when `resource_type = 'wellness'`, requires every `sub_services[i]` to have `name` (non-empty), `duration_min` (5 to 480, mod 5 = 0), and `price_eur` (>= 0 or null).
- Add `'wellness'` to any existing resource-type allow-list (tier/limit triggers, public-booking RPCs). Audit the migrations grepped above for `resource_type IN (...)` and widen them.
- No new GRANTs needed — the table already has them.

### Frontend

- `useResourceTypeLabel.ts`: add `wellness` to `defaultLabels` and `selectableTypeLabels`.
- `i18n/translations.ts`: add `dashboard.wellness`, `blocking.wellness`, plus `publicBooking.servicesMenu`, `publicBooking.totalDuration`, `publicBooking.totalPrice`, validation strings, in EN/FI/SV.
- `components/dashboard/ResourceManagement.tsx`:
  - Add the dropdown item.
  - Render the existing sub-services editor for `wellness` AND add the duration input column.
  - Reuse the same save path; just gate the duration field rendering on `resource_type === 'wellness' || === 'custom'` and require it for wellness.
- `pages/PublicBooking.tsx`:
  - When the selected resource is `wellness`, render the tick-list above the slot picker.
  - Compute total duration, clamp to [5, 480] mod 5, feed it into the existing slot-length input (which today the customer or staff picks manually).
  - Pass `selected_sub_services` through to the existing public-booking edge function (already supported).
- `supabase/functions/public-booking/index.ts`: validate that, for wellness resources, the requested duration matches the sum of ticked services (defence in depth; the client already enforces it).

### Out of scope (confirm before adding)

- Per-service availability (different staff per service) — not requested.
- Payments / deposits — explicitly excluded by you.
- Wellness-specific email template wording — defaults to today's confirmation copy.

## Files I will touch

```text
supabase/migrations/20260612143428_197d2262-d470-41e3-8715-8524f7bfaae1.sql  # widen allow-lists, validation trigger
src/i18n/translations.ts               # FI/EN/SV strings
src/hooks/useResourceTypeLabel.ts      # 'wellness' label
src/components/dashboard/ResourceManagement.tsx   # dropdown + duration column
src/pages/PublicBooking.tsx            # tick-list + auto duration
supabase/functions/public-booking/index.ts        # server-side duration check
src/pages/StaffGuide.tsx, UseCases.tsx, WhatIsMimmobook.tsx  # mention wellness (light)
supabase/functions/support-chat/prompt.ts         # add wellness to the type list
```

## Open questions

1. Should ticking services be **required** to book a wellness slot, or optional (customer can request "consultation" without picking anything)?
2. When the operator hasn't added any services yet, should the customer see an empty menu with "Contact us" or just the normal duration picker?
3. Tier-wise, does Wellness count toward the existing "resource type limit" the same way as Restaurant/Venue/Hotel (Basic = 1 type), or should it be free to add on any tier?
