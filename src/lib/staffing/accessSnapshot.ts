import { memberSiteIds } from "@/lib/staffing/siteScope";

export type SnapshotUser = { user_id: string; role: string };
export type SnapshotSiteUser = { site_id: string; user_id: string };
export type SnapshotStaff = {
  id: string;
  site_id?: string | null;
  site_ids?: string[] | null;
};

/**
 * Who can access a location right now, as stored with an accepted review.
 * Owners/admins reach every location; staff sign-ins only their assigned
 * ones. Shift staff count when they work there or at all locations.
 */
export function accessSnapshot(
  siteId: string,
  users: SnapshotUser[],
  siteUsers: SnapshotSiteUser[],
  staff: SnapshotStaff[],
): { users: string[]; staff: string[] } {
  return {
    users: users
      .filter(
        (u) =>
          u.role !== "staff" ||
          siteUsers.some(
            (su) => su.site_id === siteId && su.user_id === u.user_id,
          ),
      )
      .map((u) => u.user_id)
      .sort(),
    staff: staff
      .filter((m) => {
        const ids = memberSiteIds(m);
        return ids === null || ids.includes(siteId);
      })
      .map((m) => m.id)
      .sort(),
  };
}
