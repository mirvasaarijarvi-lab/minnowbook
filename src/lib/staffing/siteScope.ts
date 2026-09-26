/**
 * Location scoping for shift lists. A list either belongs to one location
 * (site_id set) or covers all locations (site_id null). A location view
 * includes that location's lists plus the all-locations lists.
 */
export const SITE_SCOPE_TABLE = "shift_slots.shift_periods";

/** PostgREST `or` filter for shift lists visible in a location view. */
export const siteScopeFilter = (siteId: string) =>
  `site_id.eq.${siteId},site_id.is.null`;

/** Same rule for lists already loaded in the browser. */
export const periodInSiteScope = (
  selectedSiteId: string | null,
  periodSiteId: string | null,
) => !selectedSiteId || periodSiteId === null || periodSiteId === selectedSiteId;
