/**
 * Tier-based limits for sites and reservation types.
 *
 * Tier mapping:
 *   basic         → 1 site, 1 reservation type, 1 resource per type
 *   professional  → 1 site, all types, 1 resource per type
 *   business      → unlimited sites, all types, unlimited resources
 */

interface TierLimits {
  maxSites: number | null;
  maxReservationTypes: number | null;
  maxResourcesPerType: number | null; // null = unlimited
}

const TIER_LIMITS: Record<string, TierLimits> = {
  basic: { maxSites: 1, maxReservationTypes: 1, maxResourcesPerType: 1 },
  professional: { maxSites: 1, maxReservationTypes: null, maxResourcesPerType: 1 },
  business: { maxSites: null, maxReservationTypes: null, maxResourcesPerType: null },
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
