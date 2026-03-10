import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useT } from "@/contexts/I18nContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PricingTierProps {
  name: string;
  price: number;
  description: string;
  features: string[];
  reservationTypes: string;
  staffUsers: string;
  isPopular?: boolean;
  delay?: number;
  priceId?: string;
}

const PricingTier = ({
  name, price, description, features, reservationTypes, staffUsers,
  isPopular = false, delay = 0, priceId,
}: PricingTierProps) => {
  const t = useT();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!priceId) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Not logged in — redirect to signup
        window.location.href = "/signup";
        return;
      }
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to start checkout");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border p-8 transition-all duration-300 hover:shadow-hover",
        loading
          ? "border-accent ring-2 ring-accent/40 shadow-hero scale-[1.02] bg-accent/5"
          : isPopular
            ? "border-accent shadow-hero scale-[1.02] bg-card"
            : "border-border shadow-card bg-card"
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {isPopular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="gradient-accent text-accent-foreground text-xs font-semibold px-4 py-1.5 rounded-full">
            {t("pricing.mostPopular")}
          </span>
        </div>
      )}

      <div className="mb-6">
        <h3 className="font-serif text-xl font-semibold text-foreground">{name}</h3>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>

      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-serif font-bold text-foreground">€{price}</span>
          <span className="text-muted-foreground text-sm">{t("pricing.perMonth")}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{t("pricing.trialIncluded")}</p>
      </div>

      <div className="mb-6 space-y-2 pb-6 border-b border-border">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("pricing.reservationTypes")}</span>
          <span className="font-medium text-foreground">{reservationTypes}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("pricing.staffUsers")}</span>
          <span className="font-medium text-foreground">{staffUsers}</span>
        </div>
      </div>

      <ul className="space-y-3 mb-8 flex-1">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/10 mt-0.5">
              <Check className="h-3 w-3 text-success" />
            </div>
            <span className="text-sm text-foreground/80">{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        variant={isPopular ? "hero" : "default"}
        size="lg"
        className="w-full"
        onClick={handleSubscribe}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {t("common.startFreeTrial")}
      </Button>
    </div>
  );
};

export default PricingTier;
