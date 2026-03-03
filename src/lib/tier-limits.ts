/**
 * Tier-based limits for sites and reservation types.
 *
 * Tier mapping:
 *   basic         → 1 site, 1 reservation type
 *   professional  → 1 site, all types (unlimited)
 *   business      → unlimited sites, all types (unlimited)
 */

interface TierLimits {
  maxSites: number | null;
  maxReservationTypes: number | null;
}

const TIER_LIMITS: Record<string, TierLimits> = {
  basic: { maxSites: 1, maxReservationTypes: 1 },
  professional: { maxSites: 1, maxReservationTypes: null },
  business: { maxSites: null, maxReservationTypes: null },
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
