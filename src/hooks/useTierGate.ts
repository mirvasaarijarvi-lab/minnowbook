import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import { getTierLimits, isMultiSiteTier } from "@/lib/tier-limits";

/**
 * Centralized tier-gating hook.
 *
 * System admins (superadmins) automatically bypass ALL tier restrictions.
 * Use this instead of manually checking `isSystemAdmin` + tier in components.
 *
 * Usage:
 *   const { isGated, effectiveTier, isMultiSite, canCreateSite } = useTierGate();
 *   // isGated("basic") → true if tenant is on basic AND user is NOT a system admin
 */
export function useTierGate() {
  const { tenant, isOwner, isAdmin } = useTenant();
  const { isSystemAdmin } = usePermissions();

  const rawTier = tenant?.tier ?? "basic";

  /**
   * The effective tier after applying superadmin bypass.
   * System admins are treated as "business" (highest tier) for all gate checks.
   */
  const effectiveTier = isSystemAdmin ? "business" : rawTier;

  /** True if the effective tier equals the given tier (after superadmin bypass). */
  const isTier = (tier: string) => effectiveTier === tier;

  /**
   * Returns true if a feature IS gated (locked) for the current user.
   * Pass the tier(s) that should be blocked — system admins are never gated.
   *
   * Example: isGated("basic") → true only if on basic AND not a system admin
   */
  const isGated = (...blockedTiers: string[]) => {
    if (isSystemAdmin) return false;
    return blockedTiers.includes(rawTier);
  };

  /** Whether multi-site features are available */
  const isMultiSite = isMultiSiteTier(effectiveTier);

  /** Whether the user can access business-level multi-site features (admin/owner on business, or system admin) */
  const hasMultiSiteAccess = (isMultiSite && (isOwner || isAdmin)) || isSystemAdmin;

  /** Get tier limits with superadmin bypass applied */
  const limits = getTierLimits(effectiveTier);

  /** Whether the user can create a new site given the current count */
  const canCreateSiteCheck = (currentCount: number) => {
    if (limits.maxSites === null) return true;
    return currentCount < limits.maxSites;
  };

  /** Whether a new resource of a given type can be created */
  const canCreateResourceCheck = (
    resourceType: string,
    existingResources: { resource_type: string }[]
  ) => {
    if (limits.maxResourcesTotal !== null && existingResources.length >= limits.maxResourcesTotal) {
      return false;
    }
    if (limits.maxResourcesPerType !== null) {
      const count = existingResources.filter((r) => r.resource_type === resourceType).length;
      if (count >= limits.maxResourcesPerType) return false;
    }
    return true;
  };

  return {
    /** The raw tenant tier without bypass */
    rawTier,
    /** Effective tier (business for system admins) */
    effectiveTier,
    /** Whether the user is a system admin */
    isSystemAdmin,
    /** Check if feature is gated for given tier(s) — false for system admins */
    isGated,
    /** Check if effective tier matches */
    isTier,
    /** Multi-site tier check with bypass */
    isMultiSite,
    /** Has multi-site access (tier + role, or system admin) */
    hasMultiSiteAccess,
    /** Tier limits with bypass applied */
    limits,
    /** Can create a site given current count */
    canCreateSiteCheck,
    /** Can create a resource of a type given existing resources */
    canCreateResourceCheck,
  };
}
