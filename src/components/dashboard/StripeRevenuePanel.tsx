import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Users, CreditCard } from "lucide-react";

const StripeRevenuePanel = () => {
  // Fetch all tenants with stripe data
  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ["superadmin-stripe-revenue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name, slug, tier, subscription_status, stripe_customer_id, stripe_subscription_id, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const subscribedTenants = tenants.filter((t) => t.subscription_status === "active" || t.subscription_status === "trialing");
  const activeSubs = tenants.filter((t) => t.subscription_status === "active");
  const trialingSubs = tenants.filter((t) => t.subscription_status === "trialing");
  const cancelledSubs = tenants.filter((t) => t.subscription_status === "canceled" || t.subscription_status === "cancelled");
  const withStripe = tenants.filter((t) => t.stripe_customer_id);

  // Estimate MRR based on tier pricing
  const tierPricing: Record<string, number> = {
    basic: 19,
    professional: 49,
    business: 99,
  };

  const estimatedMRR = activeSubs.reduce((sum, t) => sum + (tierPricing[t.tier] ?? 0), 0);

  const stats = [
    { label: "Est. MRR", value: `€${estimatedMRR}`, icon: DollarSign, color: "text-success-foreground bg-success/10" },
    { label: "Active Subs", value: activeSubs.length, icon: TrendingUp, color: "text-primary bg-primary/10" },
    { label: "Trialing", value: trialingSubs.length, icon: Users, color: "text-accent bg-accent/10" },
    { label: "Stripe Customers", value: withStripe.length, icon: CreditCard, color: "text-secondary-foreground bg-secondary" },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <div className="animate-spin h-6 w-6 border-4 border-accent border-t-transparent rounded-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-serif font-semibold text-foreground">Revenue & Subscriptions</h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg ${stat.color}`}>
                  <stat.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Subscription breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Subscription Breakdown by Tier</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {["basic", "professional", "business"].map((tier) => {
              const count = activeSubs.filter((t) => t.tier === tier).length;
              const trialCount = trialingSubs.filter((t) => t.tier === tier).length;
              const revenue = count * (tierPricing[tier] ?? 0);
              return (
                <div key={tier} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize text-xs">{tier}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {count} active{trialCount > 0 ? `, ${trialCount} trial` : ""}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-foreground">€{revenue}/mo</span>
                </div>
              );
            })}
          </div>
          {cancelledSubs.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              {cancelledSubs.length} cancelled subscription(s)
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StripeRevenuePanel;
