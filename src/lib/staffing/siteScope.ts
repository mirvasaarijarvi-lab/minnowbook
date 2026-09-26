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
) =>
  !selectedSiteId || periodSiteId === null || periodSiteId === selectedSiteId;

/**
 * Whether a staff member can be put on a shift list: the list covers all
 * locations, the person works at all locations, or both share a location.
 */
export function memberInListScope(
  listSiteId: string | null | undefined,
  memberSites: string | string[] | null | undefined,
): boolean {
  if (!listSiteId || !memberSites) return true;
  if (Array.isArray(memberSites))
    return memberSites.length === 0 || memberSites.includes(listSiteId);
  return listSiteId === memberSites;
}

/**
 * The locations a staff member works at, or null for all locations.
 * `site_ids` wins; older rows fall back to the single `site_id`.
 */
export function memberSiteIds(m: {
  site_id?: string | null;
  site_ids?: string[] | null;
}): string[] | null {
  if (m.site_ids && m.site_ids.length > 0) return m.site_ids;
  return m.site_id ? [m.site_id] : null;
}
