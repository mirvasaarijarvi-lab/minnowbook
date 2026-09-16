import { useEffect, useRef } from "react";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { gtm } from "@/lib/gtm";

type PermissionEmptyStateSurface =
  | "settings_panel"
  | "settings_site"
  | "public_booking_branding";

interface PermissionEmptyStateProps {
  title: string;
  description: string;
  /** Optional technical detail, shown small and muted (e.g. the server message). */
  detail?: string | null;
  /**
   * Which surface is being blocked. When provided, a
   * `permission_empty_state_shown` analytics event is sent once per
   * mount/surface so we can measure how often roles block content.
   */
  surface?: PermissionEmptyStateSurface;
  tenantId?: string | null;
  siteId?: string | null;
}

/**
 * Shown instead of a blank panel when the signed-in user's role does not
 * allow reading the data a panel needs.
 */
const PermissionEmptyState = ({
  title,
  description,
  detail,
  surface,
  tenantId,
  siteId,
}: PermissionEmptyStateProps) => {
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (!surface) return;
    const key = `${surface}:${siteId ?? ""}:${tenantId ?? ""}`;
    if (lastTracked.current === key) return;
    lastTracked.current = key;
    try {
      gtm.permissionEmptyStateShown({
        surface,
        reason: detail ?? null,
        tenant_id: tenantId ?? null,
        site_id: siteId ?? null,
      });
    } catch {
      /* analytics must never break the UI */
    }
    // `detail` is intentionally excluded: a changing server message must
    // not re-fire the event for the same blocked surface.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface, tenantId, siteId]);

  return (
    <Card>
      <CardContent className="py-10 text-center space-y-3">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted">
          <Lock className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <h3 className="text-base font-serif font-semibold text-foreground">{title}</h3>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
        {detail && <p className="text-xs text-muted-foreground/70 break-words">{detail}</p>}
      </CardContent>
    </Card>
  );
};

export default PermissionEmptyState;
