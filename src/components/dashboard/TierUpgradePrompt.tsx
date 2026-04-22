import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, ArrowRight, Check } from "lucide-react";
import { getTierLabel } from "@/lib/tier-limits";

interface TierUpgradePromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTier: string;
  feature: "sites" | "types";
}

const upgradeInfo: Record<string, { targetTier: string; features: string[] }> = {
  "basic-types": {
    targetTier: "professional",
    features: [
      "All reservation types (Restaurant, Venue, Guesthouse, Hotel)",
      "Up to 25 staff users",
      "Custom branding & branded booking page",
      "Email templates & discount codes",
    ],
  },
  "basic-sites": {
    targetTier: "business",
    features: [
      "Unlimited sites & locations",
      "All reservation types",
      "Unlimited staff users & resources per type",
      "Multi-site management dashboard",
      "Priority human support with 24h response",
    ],
  },
  "professional-sites": {
    targetTier: "business",
    features: [
      "Unlimited sites & locations",
      "Unlimited staff users & resources per type",
      "Multi-site management dashboard",
      "Priority human support with 24h response",
    ],
  },
  "professional-types": {
    targetTier: "professional",
    features: [
      "All reservation types are already included in your plan",
    ],
  },
};

const TierUpgradePrompt = ({ open, onOpenChange, currentTier, feature }: TierUpgradePromptProps) => {
  const key = `${currentTier}-${feature}`;
  const info = upgradeInfo[key] ?? upgradeInfo["basic-sites"];
  const currentLabel = getTierLabel(currentTier);
  const targetLabel = getTierLabel(info.targetTier);

  const messageMap: Record<string, string> = {
    "basic-sites": `Your ${currentLabel} plan supports 1 site. Upgrade to ${targetLabel} for unlimited locations.`,
    "basic-types": `Your ${currentLabel} plan supports 1 reservation type. Upgrade to ${targetLabel} to unlock all types.`,
    "professional-sites": `Your ${currentLabel} plan supports 1 site. Upgrade to ${targetLabel} for unlimited locations.`,
  };

  const message = messageMap[key] ??
    (feature === "sites"
      ? `Upgrade to ${targetLabel} for more locations.`
      : `Upgrade to ${targetLabel} to unlock all types.`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
            <Crown className="h-6 w-6 text-accent" />
          </div>
          <DialogTitle className="text-center font-serif">Upgrade your plan</DialogTitle>
          <DialogDescription className="text-center">{message}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-center gap-3">
            <Badge variant="outline" className="text-xs">{currentLabel}</Badge>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <Badge className="bg-accent text-accent-foreground text-xs">{targetLabel}</Badge>
          </div>

          <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">{targetLabel} includes:</p>
            {info.features.map((f) => (
              <div key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <span>{f}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Maybe later
            </Button>
            <Button className="flex-1 gap-1.5" onClick={() => window.open("/pricing", "_blank")}>
              <Crown className="h-4 w-4" />
              View Plans
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TierUpgradePrompt;
