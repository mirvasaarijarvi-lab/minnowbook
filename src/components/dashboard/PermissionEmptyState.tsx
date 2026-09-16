import { useEffect, useRef, useState } from "react";
import { Lock, Loader2, Check, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/I18nContext";
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
  /**
   * Show a "Request access" button that sends a support request to the
   * owners and admins of this account. Needs `tenantId`.
   */
  allowAccessRequest?: boolean;
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
  allowAccessRequest = false,
}: PermissionEmptyStateProps) => {
  const t = useT();
  const { session } = useAuth();
  const lastTracked = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

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

  const canRequest = allowAccessRequest && !!tenantId && !!session?.user?.id;

  const handleSend = async () => {
    if (!tenantId || !session?.user?.id) return;
    setSending(true);
    try {
      const subject = `${t("access.requestSubject")}: ${title}`;
      const body = [
        message.trim(),
        siteId ? `Site: ${siteId}` : null,
        surface ? `Screen: ${surface}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const { error } = await supabase.from("support_requests").insert({
        tenant_id: tenantId,
        user_id: session.user.id,
        subject: subject.slice(0, 200),
        message: body || subject,
      });
      if (error) throw error;

      setSent(true);
      setOpen(false);
      setMessage("");
      toast.success(t("access.requestSent"));
    } catch (e: any) {
      toast.error(e?.message || t("access.requestError"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardContent className="py-10 text-center space-y-3">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted">
          <Lock className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <h3 className="text-base font-serif font-semibold text-foreground">{title}</h3>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
        {detail && <p className="text-xs text-muted-foreground/70 break-words">{detail}</p>}

        {canRequest && (
          <div className="pt-1">
            {sent ? (
              <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-accent" aria-hidden="true" />
                {t("access.requestSentInline")}
              </p>
            ) : (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button variant="default" size="sm" className="gap-1.5">
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    {t("access.requestButton")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{t("access.requestTitle")}</DialogTitle>
                    <DialogDescription>{t("access.requestDesc")}</DialogDescription>
                  </DialogHeader>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t("access.requestPlaceholder")}
                    rows={4}
                    aria-label={t("access.requestTitle")}
                  />
                  <DialogFooter>
                    <Button onClick={handleSend} disabled={sending} className="gap-1.5">
                      {sending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          {t("access.requestSending")}
                        </>
                      ) : (
                        t("access.requestSubmit")
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PermissionEmptyState;
