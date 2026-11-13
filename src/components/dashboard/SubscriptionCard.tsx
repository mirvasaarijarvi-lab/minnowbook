import { useRef, useState } from "react";
import { ArrowRight, CreditCard, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage, useT } from "@/contexts/I18nContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { CHECKOUT_LABELS, checkoutUrl, handoffToCheckout } from "@/lib/subscription-checkout";

export default function SubscriptionCard({ tenant }: { tenant: any }) {
  const { language } = useLanguage();
  const t = useT();
  const L = CHECKOUT_LABELS[language];
  const { isAdmin } = useTenant();
  const { refreshSubscription } = useAuth();
  const [busy, setBusy] = useState<"portal" | "refresh" | null>(null);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const act = async (action: "portal" | "refresh") => {
    if (lock.current) return;
    lock.current = true;
    setBusy(action);
    setError("");
    setStatus("");
    try {
      if (action === "refresh") {
        const result = await refreshSubscription();
        if (!result) throw new Error("Verification failed");
        setStatus(result.subscribed ? L.confirmed : L.pending);
        return;
      }
      const { data, error: portalError } = await supabase.functions.invoke("customer-portal", { signal: AbortSignal.timeout(45000) });
      if (portalError) {
        if ((portalError as any).context?.status === 404) setError(L.noSubscription);
        else if ((portalError as any).context?.status === 403) setError(t("settings.planParentOnly"));
        else setError(L.portalError);
        return;
      }
      const url = checkoutUrl(data?.url);
      if (!url) throw new Error("Missing portal link");
      handoffToCheckout(url);
    } catch {
      setError(action === "portal" ? L.portalError : L.checkError);
    } finally {
      setBusy(null);
      lock.current = false;
    }
  };

  return <Card>
    <CardHeader><CardTitle className="text-lg font-serif flex items-center gap-2"><CreditCard className="h-4 w-4" />{L.title}</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-foreground capitalize">{tenant?.tier ?? "Basic"}</p>
        <p className="text-sm text-muted-foreground capitalize">{tenant?.subscription_status ?? ""}</p>
      </div>
      {!isAdmin ? <p className="text-sm text-muted-foreground">{t("settings.planParentOnly")}</p> : <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="min-h-11 h-auto whitespace-normal" disabled={busy !== null} onClick={() => void act("portal")}>
          {busy === "portal" ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" /> : <CreditCard className="h-4 w-4" />}{L.manage}
        </Button>
        <Button variant="outline" className="min-h-11 h-auto whitespace-normal" disabled={busy !== null} onClick={() => void act("refresh")}>
          {busy === "refresh" ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" /> : <RotateCcw className="h-4 w-4" />}{busy === "refresh" ? L.checking : L.refresh}
        </Button>
        <Button variant="ghost" className="min-h-11" asChild><a href="/pricing">{L.plans}<ArrowRight className="h-4 w-4" /></a></Button>
      </div>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {status && <p role="status" className="text-sm text-muted-foreground">{status}</p>}
    </CardContent>
  </Card>;
}