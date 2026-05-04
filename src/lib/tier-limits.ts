/**
 * Tier-based limits for sites, reservation types, resources, and staff users.
 *
 * Tier mapping (kept in sync with the backend functions
 * `get_tier_max_sites`, `get_tier_max_reservation_types`,
 * `get_tier_max_resources_total`, `get_tier_max_staff_users`,
 * and the `enforce_*_limit` triggers):
 *
 *   basic         → 1 site, 2 reservation types, 2 resources TOTAL (any types), 5 staff users
 *   professional  → 1 site, all types, 1 resource per type, 25 staff users
 *   business      → unlimited sites, all types, unlimited resources, unlimited staff users
 */

interface TierLimits {
  maxSites: number | null;
  maxReservationTypes: number | null;
  maxResourcesPerType: number | null; // null = no per-type cap
  maxResourcesTotal: number | null;   // null = unlimited total
  maxStaffUsers: number | null;       // null = unlimited
}

const TIER_LIMITS: Record<string, TierLimits> = {
  basic:        { maxSites: 1,    maxReservationTypes: 2,    maxResourcesPerType: null, maxResourcesTotal: 2,    maxStaffUsers: 5 },
  professional: { maxSites: 1,    maxReservationTypes: null, maxResourcesPerType: 1,    maxResourcesTotal: null, maxStaffUsers: 25 },
  business:     { maxSites: null, maxReservationTypes: null, maxResourcesPerType: null, maxResourcesTotal: null, maxStaffUsers: null },
};

export function getTierLimits(tier: string | null | undefined): TierLimits {
  return TIER_LIMITS[tier ?? "basic"] ?? TIER_LIMITS.basic;
}

export function canCreateSite(tier: string | null | undefined, currentSiteCount: number): boolean {
  const { maxSites } = getTierLimits(tier);
  if (maxSites === null) return true;
  return currentSiteCount < maxSites;
}

export function canSelectMoreTypes(tier: string | null | undefined, currentCount: number): boolean {
  const { maxReservationTypes } = getTierLimits(tier);
  if (maxReservationTypes === null) return true;
  return currentCount < maxReservationTypes;
}

/**
 * Check if a new resource of a given type can be created,
 * based on the tier's per-type resource limit.
 */
export function canCreateResourceOfType(
  tier: string | null | undefined,
  resourceType: string,
  existingResources: { resource_type: string }[]
): boolean {
  const { maxResourcesPerType } = getTierLimits(tier);
  if (maxResourcesPerType === null) return true;
  const count = existingResources.filter((r) => r.resource_type === resourceType).length;
  return count < maxResourcesPerType;
}

/**
 * Returns the max number of staff users (tenant_users rows) allowed for a tier.
 * `null` means unlimited. Mirrors the backend `get_tier_max_staff_users` function.
 */
export function getMaxStaffUsers(tier: string | null | undefined): number | null {
  return getTierLimits(tier).maxStaffUsers;
}

/**
 * Whether the tenant can add another staff user given its current count.
 * Existing rows over the limit (e.g. after a downgrade) are tolerated —
 * only NEW additions are blocked, matching the backend trigger.
 */
export function canAddStaffUser(
  tier: string | null | undefined,
  currentStaffCount: number
): boolean {
  const max = getMaxStaffUsers(tier);
  if (max === null) return true;
  return currentStaffCount < max;
}

export function isResourceTypeAllowed(
  tier: string | null | undefined,
  resourceType: string,
  allowedTypes: string[]
): boolean {
  return allowedTypes.includes(resourceType);
}

export function getTierLabel(tier: string): string {
  switch (tier) {
    case "basic": return "Basic";
    case "professional": return "Pro";
    case "business": return "Business";
    default: return tier;
  }
}

/** Whether the tier supports multi-site features (business or higher) */
export function isMultiSiteTier(tier: string | null | undefined): boolean {
  return tier === "business";
}
