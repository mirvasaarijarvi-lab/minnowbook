import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ArrowLeft, Check, Crown, Zap, Rocket, UtensilsCrossed, Building2, BedDouble, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { canSelectMoreTypes, getTierLimits } from "@/lib/tier-limits";
import { useT } from "@/contexts/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import TierUpgradePrompt from "@/components/dashboard/TierUpgradePrompt";
import { TranslationKey } from "@/i18n/translations";

const colorPresets = [
  { name: "Deep Plum", primary: "#4a1d7a", secondary: "#f5efe4", accent: "#ff4d1c" },
  { name: "Ocean Blue", primary: "#1e40af", secondary: "#eff6ff", accent: "#f59e0b" },
  { name: "Forest Green", primary: "#166534", secondary: "#f0fdf4", accent: "#ea580c" },
  { name: "Slate Grey", primary: "#334155", secondary: "#f8fafc", accent: "#8b5cf6" },
  { name: "Warm Terracotta", primary: "#9a3412", secondary: "#fff7ed", accent: "#0891b2" },
];

const Onboarding = () => {
  const { user } = useAuth();
  const { tenantId, loading: tenantLoading } = useTenant();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const t = useT();
  const [selectedTier, setSelectedTier] = useState("basic");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [branding, setBranding] = useState({
    businessName: "", businessEmail: user?.email ?? "", businessPhone: "",
    businessAddress: "", businessDescription: "",
    primaryColor: "#4a1d7a", secondaryColor: "#f5efe4", accentColor: "#ff4d1c",
  });

  // If user already has a tenant, redirect to dashboard
  if (tenantLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (tenantId) {
    return <Navigate to="/dashboard" replace />;
  }

  const STEPS: TranslationKey[] = ["onboarding.tierStep", "onboarding.typesStep", "onboarding.brandingStep"];

  const tiers = [
    { id: "basic", nameKey: "tier.basic" as TranslationKey, icon: Zap, price: "€29/mo", descKey: "tier.basicDesc" as TranslationKey, features: ["1 reservation type", "3 staff users", "Email notifications", "Booking page"] },
    { id: "professional", nameKey: "tier.professional" as TranslationKey, icon: Crown, price: "€59/mo", descKey: "tier.professionalDesc" as TranslationKey, features: ["3 reservation types", "10 staff users", "Custom branding", "Priority support"] },
    { id: "enterprise", nameKey: "tier.enterprise" as TranslationKey, icon: Rocket, price: "€99/mo", descKey: "tier.enterpriseDesc" as TranslationKey, features: ["Unlimited types", "Unlimited staff", "API access", "Dedicated support"] },
  ];

  const reservationTypes = [
    { id: "restaurant", labelKey: "dashboard.restaurant" as TranslationKey, icon: UtensilsCrossed, descKey: "onboarding.restaurantDesc" as TranslationKey },
    { id: "venue", labelKey: "dashboard.venue" as TranslationKey, icon: Building2, descKey: "onboarding.venueDesc" as TranslationKey },
    { id: "guesthouse", labelKey: "dashboard.guesthouse" as TranslationKey, icon: BedDouble, descKey: "onboarding.guesthouseDesc" as TranslationKey },
    { id: "hotel", labelKey: "dashboard.hotel" as TranslationKey, icon: BedDouble, descKey: "onboarding.hotelDesc" as TranslationKey },
  ];

  const toggleType = (id: string) => {
    setSelectedTypes((prev) => {
      if (prev.includes(id)) return prev.filter((t) => t !== id);
      if (!canSelectMoreTypes(selectedTier, prev.length)) {
        setUpgradeOpen(true);
        return prev;
      }
      return [...prev, id];
    });
  };

  // When tier changes, trim selected types if over the new limit
  const handleTierChange = (tierId: string) => {
    setSelectedTier(tierId);
    const { maxReservationTypes } = getTierLimits(tierId);
    if (maxReservationTypes !== null && selectedTypes.length > maxReservationTypes) {
      setSelectedTypes((prev) => prev.slice(0, maxReservationTypes));
    }
  };

  const generateSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const canProceed = () => {
    if (step === 0) return !!selectedTier;
    if (step === 1) return selectedTypes.length > 0;
    if (step === 2) return branding.businessName.trim().length > 0;
    return false;
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const slug = generateSlug(branding.businessName);
      const { error } = await supabase.rpc("create_tenant", {
        p_name: branding.businessName, p_slug: slug, p_tier: selectedTier,
        p_allowed_reservation_types: selectedTypes,
        p_display_name: user?.user_metadata?.display_name ?? null,
        p_primary_color: branding.primaryColor, p_secondary_color: branding.secondaryColor,
        p_accent_color: branding.accentColor,
        p_business_description: branding.businessDescription || null,
        p_business_email: branding.businessEmail || null,
        p_business_phone: branding.businessPhone || null,
        p_business_address: branding.businessAddress || null,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["tenant-user"] });
      toast({ title: t("dashboard.welcome") + "!", description: "Your workspace is ready." });
      navigate("/dashboard");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <Logo variant="color" size="sm" />
        <LanguageSwitcher variant="compact" />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((labelKey, i) => (
            <div key={labelKey} className="flex items-center gap-2">
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors",
                i < step ? "bg-accent text-accent-foreground" :
                i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={cn("text-sm font-medium hidden sm:inline", i === step ? "text-foreground" : "text-muted-foreground")}>{t(labelKey)}</span>
              {i < STEPS.length - 1 && <div className="w-8 h-px bg-border" />}
            </div>
          ))}
        </div>

        <div className="w-full max-w-2xl">
          {step === 0 && (
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-2xl font-serif font-bold text-foreground">{t("onboarding.choosePlan")}</h1>
                <p className="text-muted-foreground mt-1">{t("onboarding.choosePlanSubtitle")}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {tiers.map((tier) => {
                  const Icon = tier.icon;
                  const selected = selectedTier === tier.id;
                  return (
                    <Card key={tier.id} className={cn("cursor-pointer transition-all hover:shadow-hover", selected && "ring-2 ring-primary shadow-hover")} onClick={() => handleTierChange(tier.id)}>
                      <CardContent className="p-5 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className={cn("p-2 rounded-md", selected ? "bg-primary/10" : "bg-secondary")}>
                            <Icon className={cn("h-5 w-5", selected ? "text-primary" : "text-muted-foreground")} />
                          </div>
                          <div>
                            <p className="font-serif font-semibold text-foreground">{t(tier.nameKey)}</p>
                            <p className="text-sm font-bold text-accent">{tier.price}</p>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{t(tier.descKey)}</p>
                        <ul className="space-y-1">
                          {tier.features.map((f) => (
                            <li key={f} className="text-xs text-muted-foreground flex items-center gap-1.5"><Check className="h-3 w-3 text-accent" /> {f}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-2xl font-serif font-bold text-foreground">{t("onboarding.whatDoYouNeed")}</h1>
                <p className="text-muted-foreground mt-1">{t("onboarding.whatDoYouNeedSubtitle")}</p>
              </div>
              {(() => {
                const limits = getTierLimits(selectedTier);
                const limitLabel = limits.maxReservationTypes === null
                  ? "Unlimited types"
                  : `${selectedTypes.length}/${limits.maxReservationTypes} type${limits.maxReservationTypes > 1 ? "s" : ""} selected`;
                return (
                  <p className="text-sm text-muted-foreground text-center mb-2">
                    {limitLabel}
                  </p>
                );
              })()}
              <div className="grid gap-3 sm:grid-cols-3">
                {reservationTypes.map((type) => {
                  const Icon = type.icon;
                  const selected = selectedTypes.includes(type.id);
                  const atLimit = !selected && !canSelectMoreTypes(selectedTier, selectedTypes.length);
                  return (
                    <Card key={type.id} className={cn("cursor-pointer transition-all hover:shadow-hover", selected && "ring-2 ring-primary shadow-hover", atLimit && "opacity-50 cursor-not-allowed")} onClick={() => !atLimit && toggleType(type.id)}>
                      <CardContent className="p-6 text-center space-y-3">
                        <div className={cn("mx-auto p-3 rounded-full w-fit", selected ? "bg-primary/10" : "bg-secondary")}>
                          <Icon className={cn("h-6 w-6", selected ? "text-primary" : "text-muted-foreground")} />
                        </div>
                        <p className="font-serif font-semibold text-foreground">{t(type.labelKey)}</p>
                        <p className="text-sm text-muted-foreground">{t(type.descKey)}</p>
                        {selected && <Badge className="bg-primary text-primary-foreground">{t("onboarding.selected")}</Badge>}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-2xl font-serif font-bold text-foreground">{t("onboarding.brandWorkspace")}</h1>
                <p className="text-muted-foreground mt-1">{t("onboarding.brandWorkspaceSubtitle")}</p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <h3 className="font-serif font-semibold text-foreground">{t("onboarding.businessDetails")}</h3>
                    <div><Label>{t("onboarding.businessNameRequired")}</Label><Input value={branding.businessName} onChange={(e) => setBranding({ ...branding, businessName: e.target.value })} placeholder="e.g. Restaurant Wiurila" /></div>
                    <div><Label>{t("common.email")}</Label><Input type="email" value={branding.businessEmail} onChange={(e) => setBranding({ ...branding, businessEmail: e.target.value })} placeholder="contact@example.com" /></div>
                    <div><Label>{t("common.phone")}</Label><Input value={branding.businessPhone} onChange={(e) => setBranding({ ...branding, businessPhone: e.target.value })} placeholder="+358 40 123 4567" /></div>
                    <div><Label>{t("common.address")}</Label><Input value={branding.businessAddress} onChange={(e) => setBranding({ ...branding, businessAddress: e.target.value })} placeholder="Wiurilantie 1, Halikko" /></div>
                    <div><Label>{t("common.description")}</Label><Input value={branding.businessDescription} onChange={(e) => setBranding({ ...branding, businessDescription: e.target.value })} placeholder="Short description" /></div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <h3 className="font-serif font-semibold text-foreground flex items-center gap-2"><Palette className="h-4 w-4" /> {t("onboarding.brandColors")}</h3>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">{t("onboarding.presets")}</Label>
                      <div className="flex flex-wrap gap-2">
                        {colorPresets.map((preset) => (
                          <button key={preset.name} onClick={() => setBranding({ ...branding, primaryColor: preset.primary, secondaryColor: preset.secondary, accentColor: preset.accent })}
                            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
                              branding.primaryColor === preset.primary ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-primary/50"
                            )}>
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: preset.primary }} />{preset.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {([["primaryColor", "onboarding.primary"], ["secondaryColor", "onboarding.secondary"], ["accentColor", "onboarding.accent"]] as const).map(([key, labelKey]) => (
                        <div key={key}>
                          <Label className="text-xs">{t(labelKey as TranslationKey)}</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <input type="color" value={branding[key]} onChange={(e) => setBranding({ ...branding, [key]: e.target.value })} className="w-8 h-8 rounded cursor-pointer border border-border" />
                            <span className="text-xs text-muted-foreground">{branding[key]}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">{t("onboarding.preview")}</Label>
                      <div className="mt-1 rounded-lg border border-border overflow-hidden">
                        <div className="h-10 flex items-center px-3 gap-2" style={{ backgroundColor: branding.primaryColor }}>
                          <span className="text-xs font-medium" style={{ color: branding.secondaryColor }}>{branding.businessName || "Your Business"}</span>
                        </div>
                        <div className="p-3" style={{ backgroundColor: branding.secondaryColor }}>
                          <div className="h-2 w-24 rounded" style={{ backgroundColor: branding.primaryColor, opacity: 0.2 }} />
                          <div className="mt-2"><span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: branding.accentColor, color: "#fff" }}>Book Now</span></div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8">
            <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> {t("common.back")}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed()} className="gap-1.5">
                {t("common.continue")} <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={!canProceed() || saving} className="gap-1.5">
                {saving ? t("onboarding.creatingWorkspace") : t("onboarding.finishSetup")}
                <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </main>
      <TierUpgradePrompt
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        currentTier={selectedTier}
        feature="types"
      />
    </div>
  );
};

export default Onboarding;
