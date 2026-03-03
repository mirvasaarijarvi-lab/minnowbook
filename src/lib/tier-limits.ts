/**
 * Tier-based limits for sites and reservation types.
 *
 * Tier mapping:
 *   basic         → 1 site, 1 reservation type
 *   professional  → 1 site, all types (unlimited)
 *   enterprise    → unlimited sites, unlimited types
 */

export interface TierLimits {
  maxSites: number | null; // null = unlimited
  maxReservationTypes: number | null; // null = unlimited
}

const TIER_LIMITS: Record<string, TierLimits> = {
  basic: { maxSites: 1, maxReservationTypes: 1 },
  professional: { maxSites: 1, maxReservationTypes: null },
  enterprise: { maxSites: null, maxReservationTypes: null },
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
  // Resource type must be in the tenant's allowed_reservation_types
  return allowedTypes.includes(resourceType);
}

export function getTierLabel(tier: string): string {
  switch (tier) {
    case "basic": return "Basic";
    case "professional": return "Pro";
    case "enterprise": return "Business";
    default: return tier;
  }
}
