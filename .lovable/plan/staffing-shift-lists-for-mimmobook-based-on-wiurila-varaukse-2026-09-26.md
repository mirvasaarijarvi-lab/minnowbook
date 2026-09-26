# Staffing: shift lists for MimmoBook (based on Wiurila Varaukset)

## What Wiurila has today
- **Staffing page**: staff needed per booking and per hour (guests, planned, rostered, needed), understaffed hours flagged, cost estimate, adjustable staffing ratios, notes per booking.
- **Shift list**: multi-week list (3 weeks A3, 1 month, 3 months). Rows = role + worker; cells take `10-18` or leave codes (V, X, Z, L, P). Row totals: hours, Sunday/holiday, evening, night.
- **Staff register**: names, roles, employment type, contact, weekly hours target, active flag.
- **Planned vs realized hours**: second mode for actual times, planned shown in grey.
- **Exports**: print whole list (A3 landscape), per-worker sheet with preview, Excel export, payroll Excel (summary + shifts sheets) and CSV.
- **Filters**: search by name/task, role filter, "only this worker", clear filters.
- **Change history**: who changed which shift and when.
- **Keyboard**: Tab/arrow keys move between cells.
- Approval stages exist but are hidden.

## What MimmoBook gets (same features, multi-business)
1. **New "Staffing" dashboard tab** with two sub-views: Staffing needs and Shift list.
2. **Staff register** per business (and optionally per site). Staff here are people on the roster, not login accounts, so they don't count toward the plan's user limit.
3. **Roles per business**: default roles picked from the business's resource types (restaurant: waiter, kitchen, dishwasher; hotel: reception, cleaning; service: therapist, barber etc.), editable.
4. **Shift list** with the same cell input, leave codes, totals, planned/realized modes, filters, keyboard navigation, print, per-worker sheet, Excel/CSV and payroll exports.
5. **Pay rules configurable per business** (evening start/end, night window, Sunday/holiday counting) with Finnish defaults, since MimmoBook customers aren't all in Finland. Leave code letters stay, with labels in EN/FI/SV.
6. **Staffing needs** from bookings: needed staff per hour from guests and per-resource-type ratios, compared to the shift list, understaffed hours flagged.
7. **Change history** per shift list.
8. **Approval stages** left out, like Wiurila.

## Plans (suggestion, you decide)
- Basic: staff register + one shift list at a time, print.
- Professional: unlimited lists, realized hours, Excel/CSV exports, staffing needs.
- Business: payroll export, change history, per-site lists.

## Help content (EN/FI/SV, no dashes)
- **Quick guide**: new "Staffing and shifts" chapter (add staff, create a list, typing shifts and codes, realized hours, printing and payroll export).
- **Support page**: new questions (how to build a shift list, what the codes mean, how payroll export works, how staffing needs are counted).
- **MimmoAid**: new help bullets, put live, saved instruction copy refreshed.
- **Pricing and Features pages**: new rows / description to match the plan split above.

## Safety
- Every table scoped to the business; only members of that business see it. Owners/admins manage staff, roles, pay rules and delete lists; staff can view and, if allowed, record realized hours.
- Staff contact details only visible to owners/admins.
- Booking, pricing and public booking pages untouched; staffing only reads bookings.

## Technical details
- Tables (all with `tenant_id`, optional `site_id`, GRANTs + RLS via `is_user_tenant_member` / `has_tenant_role`): `staff_roles`, `staff_members`, `shift_periods`, `shift_slots`, `shifts` (planned + actual times, code, note), `shift_change_log` (trigger, SECURITY DEFINER with `search_path = public`), `staffing_settings` (per tenant jsonb: ratios, hourly cost, pay windows).
- Port pure libs from Wiurila with tests: `shiftList`, `shiftPayroll`, `shiftSlotFilter`, `shiftFieldNavigation`, `shiftChangeLog`, `workerShiftPdf`, `staffingRatios`, `staffingPreview`; pay windows become parameters.
- Hooks `useShiftList`, components `StaffingTab`, `shifts/ShiftListTab`, `StaffRegisterDialog`, `WorkerSheetPreviewDialog`, `ShiftHistoryDialog`; labels moved into `translations.ts`.
- Tier gating via `useTierGate`; permission keys added to role_permissions seed.
- Excel via the existing export library used by Reports; CSV through the existing sanitizer.
- Tests: unit tests ported, RLS tenant-isolation tests for new tables, snapshot refresh for MimmoAid.
