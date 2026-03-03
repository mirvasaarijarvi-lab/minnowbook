import { usePermissions } from "@/hooks/usePermissions";
import { PERM_SITES_APPROVE } from "@/lib/permissions";
import { useTenant } from "@/hooks/useTenant";

/**
 * Returns the approval_status that should be used when creating/updating
 * site-scoped records. Privileged users (owners or those with sites.approve)
 * get auto-approved; others get "pending".
 */
export function useAutoApproval() {
  const { isOwner } = useTenant();
  const { can } = usePermissions();

  const isPrivileged = isOwner || can(PERM_SITES_APPROVE);

  /** Returns "approved" for privileged users, "pending" otherwise */
  const getApprovalStatus = () => (isPrivileged ? "approved" : "pending");

  return { isPrivileged, getApprovalStatus };
}
