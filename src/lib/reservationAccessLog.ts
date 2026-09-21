import { supabase } from "@/integrations/supabase/client";

export type ReservationAccessAction = "view" | "search" | "export" | "print";

type LogArgs = {
  tenantId?: string | null;
  action: ReservationAccessAction;
  recordCount?: number;
  siteId?: string | null;
};

/**
 * Records that a staff member read or exported reservation data.
 *
 * Fire-and-forget on purpose: telemetry must never block or break a staff
 * screen. The backend stores the calling user's own id (auth.uid()) and
 * rejects rows for tenants the caller does not belong to, so nothing here is
 * trusted as an identity claim. The scoring job in
 * public.detect_security_alerts reads these rows to spot volume spikes,
 * off-hours access and reach into unfamiliar sites.
 */
export const logReservationAccess = ({
  tenantId,
  action,
  recordCount = 0,
  siteId = null,
}: LogArgs): void => {
  if (!tenantId) return;

  void supabase
    .rpc("log_reservation_access", {
      p_tenant_id: tenantId,
      p_action: action,
      p_record_count: Math.max(0, Math.round(recordCount)),
      p_site_id: siteId,
    })
    .then(() => undefined)
    .catch(() => undefined);
};

/**
 * Records a failed sign-in attempt. Runs before a session exists, so it is
 * callable anonymously. The raw address never leaves the database function:
 * only a masked form and a salted hash are stored.
 */
export const recordAuthFailure = (
  email: string,
  reason: string,
  tenantSlug?: string | null,
): void => {
  void supabase
    .rpc("record_auth_failure", {
      p_email: email,
      p_reason: reason.slice(0, 200),
      p_tenant_slug: tenantSlug ?? null,
      p_user_agent:
        typeof navigator === "undefined" ? null : navigator.userAgent,
    })
    .then(() => undefined)
    .catch(() => undefined);
};
