# Drill-down reports by resource

## Goal
Let tenant owners and admins click from a report total down to the detail behind it, grouped by the resources they set up (saunas, rooms, tables, event spaces, sub-services, special occasions), and download each level as CSV or PDF. A drill-down only appears once the tenant has the data it needs. It is never shown empty.

## How it works for the user
```text
Reports > Drill-down
  Level 1: Service type   (Sauna | Hotel | Restaurant | Venue ...)
  Level 2: Resource       (Sauna A, Sauna B, Room 101 ...)
  Level 3: Product / sub-service / occasion
  Level 4: Reservation list (date, guests, status, price)
```
- Uses the date range, site and comparison period already on the Reports page.
- A breadcrumb at the top lets you go back up. Clicking a row goes one level down.
- "Download CSV" and "Download PDF" export the level you are looking at, with the breadcrumb path in the title and file name.
- Resource and product names come from the tenant's own setup (custom type labels, sub-services), in EN, FI and SV.

## Drill-downs (each turns on when its data exists)
1. **By product / resource** (default): bookings, guests, revenue, discount given, average price, cancellations. Needs at least 1 active resource.
2. **By sub-service / add-on**: how often each extra (for example towels or breakfast) is picked and what it earns. Needs resources that have sub-services.
3. **By special occasion or tour**: seats sold vs capacity, fill rate per seating time, revenue. Needs at least 1 special occasion. This matches the Wiurila tours setup.
4. **Utilisation**: hours or nights booked vs open hours per resource, including blocked time. Needs opening hours.
5. **Time pattern per resource**: weekday x hour heatmap, down to the reservations in that cell. This reuses the peak hours logic.
6. **Booking channel per resource**: public page vs staff-created, per resource. This reuses the channel logic.
7. **Discount code impact**: uses and revenue per code, then per resource. Needs discount codes.
8. **Guest origin and repeat guests**: new vs returning guests per resource, and group size bands. The export shows totals only, with no guest names at the aggregate levels.
9. **Offers to bookings**: offer conversion per event space. Needs offers.
10. **Kitchen items**: quantity and value per menu item per resource. Needs kitchen resources.

Tier suggestion: Basic gets 1 and 3. Professional adds 2, 4, 5 and 6. Business gets all of them. I can change this.

## Privacy and security
- All queries stay tenant-scoped and site-scoped under the existing access rules. The export tenant-denial tests are extended to cover the new exports.
- Only the reservation-list level shows guest names or emails. Only users with the report permission can see or export it.
- CSV cells are cleaned with the existing sanitizer to block formula injection.

## Technical details
- New pure module `src/lib/drilldown.ts`: `groupBy(level)`, metrics and an availability check per drill-down, with unit tests.
- New `DrillDownPanel.tsx` inside ReportsPanel. It keeps its state (the breadcrumb stack) in the URL search params, so a view can be shared.
- Data: one reservations query per range, joined client-side with resources, sub-services (JSONB `selected_sub_services`), special_occasions, discount_codes, offers, kitchen_orders. Existing indexes cover tenant_id + date. If data volumes grow, I can add an RPC with SQL aggregation later.
- Exports reuse `buildReportCsv`, `reportCsvFileName` and `buildReportPdf`.
- Tier gating goes through `useTierGate`. Permission checks go through `usePermissions`.
- i18n keys in EN/FI/SV, with no dashes in the copy.
- Tests: aggregation unit tests, and new entries in EXPORT_SURFACES for the deny-case suite.
- No database schema changes.

## Out of scope
- Scheduled or emailed drill-down reports. These could be added later to the weekly report.
