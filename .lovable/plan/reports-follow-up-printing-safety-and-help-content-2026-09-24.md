# Reports follow-up: printing, safety, and help content

Continues the approved drill-down plan (archived). Items you added to the old plan were not saved. Please add them to this plan again.

## 1. Finish the drill-down report
- Add the remaining 6 groupings: utilisation, time pattern per resource, discount code impact, new vs returning guests, offers to bookings, and kitchen items. Each one only appears when the tenant has the data it needs.
- The drill-down follows the date range and site chosen at the top of the Reports page, instead of having its own period menu.
- The current level is kept in the web address, so a drill-down view can be shared or bookmarked.
- Extend the tests that check a download never contains another customer's data, so they also cover the new drill-down CSV and PDF files.

## 2. Printing (modelled on Wiurila Varaukset)
- A shared **period picker** at the top of the Reports page, with presets (week, month, quarter, year) and custom from and to dates. Every section on the page uses this period.
- **Print whole page**: one button prints every section for the chosen period. There is a cover header with the business name, site and period.
- **Print this section**: each section (overview, forecast, peak hours, weekdays, booking channel, cross-booking, drill-down at its current level) gets its own print button.
- A print-only stylesheet hides menus, buttons and filters. Charts keep their colours, sections never split across pages, and tables repeat their headers on each page. Page size is A4 (portrait by default, landscape for wide tables).
- Guest names only appear in print for owners and admins, the same rule as downloads.

## 3. No effect on booking operations
- Changes stay inside the dashboard Reports area and its print styles. Reports only read data.
- No changes to the public booking page, booking server code, pricing, emails or database. The only exception is the optional resource link in point 5, and it only happens if you approve it.
- Checks before finishing: the existing public booking tests, the price and tenant security tests, and a full build. I'll also compare the public booking page before and after the change.

## 4. Pricing, features and help content
- **Pricing page comparison table**: new rows for "Drill-down reports", "Download CSV and PDF" and "Print reports", with what each plan includes. Basic gets resource and tour drill-downs. Professional adds products, channels, utilisation and time patterns. Business gets all of them.
- **Features page**: a Reports section describing drill-downs, downloads and printing. It has no stock images, and uses real screenshots only if you want them.
- **MimmoAid chatbot**: its knowledge covers how to open Reports, pick a period, drill down, download and print.
- **Quick guide** (printable staff guide): a new "Reports" chapter with numbered steps.
- **Support page**: new FAQ entries, such as "How do I build a report for one product?" and "How do I print only one section?".
- All copy is in EN, FI and SV, with no dashes.

## 5. Optional, needs your decision
Bookings don't record which resource they were for, so resource totals are estimated. Saving the chosen resource with each new booking would make them exact. This does touch the booking flow. It is a small addition, but it only happens if you say yes.

## Technical details
- `ReportsPeriodContext` holds the period and site. Every panel reads from it.
- `PrintSection` wrapper plus a `print-section` class. For a single section, the page adds `data-print-target` and calls `window.print()`, and the `@media print` rules hide everything else.
- Help content lives in the existing chatbot knowledge base, quick guide and support FAQ modules.
