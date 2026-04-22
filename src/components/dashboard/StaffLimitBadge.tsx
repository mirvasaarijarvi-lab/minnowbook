import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getMaxStaffUsers, getTierLabel } from "@/lib/tier-limits";
import { cn } from "@/lib/utils";

interface StaffLimitBadgeProps {
  /** Tenant tier (e.g. "basic" / "professional" / "business"). */
  tier: string | null | undefined;
  /** Current number of staff users (rows in `tenant_users` for the tenant). */
  currentCount: number;
  /**
   * If true, treat the tenant as unlimited (e.g. system admin impersonation)
   * regardless of tier. Mirrors the bypass in `enforce_staff_user_limit`.
   */
  unlimitedOverride?: boolean;
  className?: string;
}

/**
 * Small inline badge that shows the tenant's current staff usage vs.
 * its tier cap, e.g. `3 / 5 staff`. The cap is read from
 * {@link getMaxStaffUsers}, which mirrors the backend
 * `get_tier_max_staff_users` SQL function.
 *
 * - Unlimited tier (or `unlimitedOverride`) → renders `N / ∞ staff`.
 * - At/over the cap → switches to a `destructive` variant so the user
 *   notices before clicking "Add user" (the button is also disabled
 *   in {@link AdminPanel}).
 */
export function StaffLimitBadge({
  tier,
  currentCount,
  unlimitedOverride = false,
  className,
}: StaffLimitBadgeProps) {
  const max = getMaxStaffUsers(tier);
  const isUnlimited = unlimitedOverride || max === null;
  const atLimit = !isUnlimited && currentCount >= (max as number);

  const label = isUnlimited
    ? `${currentCount} / ∞ staff`
    : `${currentCount} / ${max} staff`;

  const tooltip = isUnlimited
    ? `${getTierLabel(tier ?? "basic")} plan: unlimited staff users.`
    : `${getTierLabel(tier ?? "basic")} plan allows up to ${max} staff users.`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant={atLimit ? "destructive" : "secondary"}
          className={cn("gap-1 font-normal", className)}
          aria-label={tooltip}
        >
          <Users className="h-3 w-3" aria-hidden="true" />
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export default StaffLimitBadge;
