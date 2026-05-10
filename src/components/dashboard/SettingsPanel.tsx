import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useTierGate } from "@/hooks/useTierGate";
import { useT, useTDynamic } from "@/contexts/I18nContext";
import { useSiteContext } from "@/hooks/useSiteContext";
import SiteTabs from "./SiteTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Upload, X, ImageIcon, Building2, ArrowRight, MapPin, Mail, Phone, Palette, RotateCcw, CreditCard, Crown, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import DashboardTooltip from "./DashboardTooltip";
import EmailTemplateEditor from "./EmailTemplateEditor";
import OpeningHoursSettings from "./OpeningHoursSettings";
import DiscountCodesPanel from "./DiscountCodesPanel";
import RedeemAccessCode from "./RedeemAccessCode";
import ReservationTypesCard from "./ReservationTypesCard";

const SITE_COLOR_PRESETS = [
  { name: "Navy & Amber", primary: "#1e3a5f", secondary: "#f5f0e8", accent: "#d4a853" },
  { name: "Forest & Gold", primary: "#2d5016", secondary: "#f0f4ec", accent: "#c8a951" },
  { name: "Burgundy & Cream", primary: "#722f37", secondary: "#faf5f0", accent: "#d4a853" },
  { name: "Slate & Coral", primary: "#334155", secondary: "#f8fafc", accent: "#f97316" },
  { name: "Indigo & Rose", primary: "#3730a3", secondary: "#f5f3ff", accent: "#e11d48" },
];

interface SiteSettingsForm {
  business_name: string;
  business_email: string;
  business_phone: string;
  business_address: string;
  business_description: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
}

const EMPTY_FORM: SiteSettingsForm = {
  business_name: "",
  business_email: "",
  business_phone: "",
  business_address: "",
  business_description: "",
  primary_color: "",
  secondary_color: "",
  accent_color: "",
};

const SiteSettingsInfo = ({ siteId, tenantId }: { siteId: string; tenantId: string }) => {
  const t = useT();
  const tDynamic = useTDynamic();
  const queryClient = useQueryClient();

  // Site basic info
  const { data: site } = useQuery({
    queryKey: ["site-settings-info", siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sites")
        .select("name, slug, location, description")
        .eq("id", siteId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!siteId,
  });

  // Tenant (parent) defaults
  const { data: tenantSettings } = useQuery({
    queryKey: ["tenant-settings-for-site", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_settings")
        .select("business_name, business_email, business_phone, business_address, business_description, primary_color, secondary_color, accent_color")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Site-specific overrides
  const { data: siteSettings, isLoading: loadingSiteSettings } = useQuery({
    queryKey: ["site-settings", siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .eq("site_id", siteId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!siteId,
  });

  // Determine if the site has custom overrides
  const hasOverrides = !!siteSettings && (
    siteSettings.business_name || siteSettings.business_email || siteSettings.business_phone ||
    siteSettings.business_address || siteSettings.business_description ||
    siteSettings.primary_color || siteSettings.secondary_color || siteSettings.accent_color
  );

  const [customized, setCustomized] = useState(false);
  const [form, setForm] = useState<SiteSettingsForm>(EMPTY_FORM);

  // Build the effective (merged) values: site override ?? tenant default
  const effective = {
    business_name: siteSettings?.business_name || tenantSettings?.business_name || "",
    business_email: siteSettings?.business_email || tenantSettings?.business_email || "",
    business_phone: siteSettings?.business_phone || tenantSettings?.business_phone || "",
    business_address: siteSettings?.business_address || tenantSettings?.business_address || "",
    business_description: siteSettings?.business_description || tenantSettings?.business_description || "",
    primary_color: siteSettings?.primary_color || tenantSettings?.primary_color || "#1e3a5f",
    secondary_color: siteSettings?.secondary_color || tenantSettings?.secondary_color || "#f5f0e8",
    accent_color: siteSettings?.accent_color || tenantSettings?.accent_color || "#d4a853",
  };

  // Sync state when data loads
  useEffect(() => {
    setCustomized(!!hasOverrides);
    if (hasOverrides && siteSettings) {
      setForm({
        business_name: siteSettings.business_name ?? "",
        business_email: siteSettings.business_email ?? "",
        business_phone: siteSettings.business_phone ?? "",
        business_address: siteSettings.business_address ?? "",
        business_description: siteSettings.business_description ?? "",
        primary_color: siteSettings.primary_color ?? "",
        secondary_color: siteSettings.secondary_color ?? "",
        accent_color: siteSettings.accent_color ?? "",
      });
    } else {
      // Pre-fill with parent defaults when switching to custom
      setForm({
        business_name: tenantSettings?.business_name ?? "",
        business_email: tenantSettings?.business_email ?? "",
        business_phone: tenantSettings?.business_phone ?? "",
        business_address: tenantSettings?.business_address ?? "",
        business_description: tenantSettings?.business_description ?? "",
        primary_color: tenantSettings?.primary_color ?? "#1e3a5f",
        secondary_color: tenantSettings?.secondary_color ?? "#f5f0e8",
        accent_color: tenantSettings?.accent_color ?? "#d4a853",
      });
    }
  }, [siteSettings, tenantSettings, hasOverrides, siteId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!customized) {
        // Delete overrides, revert to parent defaults
        if (siteSettings?.id) {
          const { error } = await supabase.from("site_settings").delete().eq("id", siteSettings.id);
          if (error) throw error;
        }
        return;
      }
      // Build payload: only store non-empty values (empty = inherit)
      const payload: any = {
        site_id: siteId,
        tenant_id: tenantId,
        business_name: form.business_name || null,
        business_email: form.business_email || null,
        business_phone: form.business_phone || null,
        business_address: form.business_address || null,
        business_description: form.business_description || null,
        primary_color: form.primary_color || null,
        secondary_color: form.secondary_color || null,
        accent_color: form.accent_color || null,
      };
      if (siteSettings?.id) {
        const { error } = await supabase.from("site_settings").update(payload).eq("id", siteSettings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("site_settings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-settings", siteId] });
      toast.success(t("settings.siteSettingsSaved"));
    },
    onError: (err: any) => {
      toast.error(err?.message || t("settings.saveError"));
    },
  });

  const updateField = (key: keyof SiteSettingsForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const resetFieldToParent = (key: keyof SiteSettingsForm) => {
    const parentVal = (tenantSettings as any)?.[key] ?? "";
    setForm((prev) => ({ ...prev, [key]: parentVal }));
  };

  if (!site) return null;

  return (
    <div className="space-y-6">
      {/* Site header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-serif">{site.name}</CardTitle>
            
          </div>
          {site.location && (
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="h-3.5 w-3.5" /> {site.location}
            </p>
          )}
          {site.description && (
            <p className="text-sm text-muted-foreground mt-1">{site.description}</p>
          )}
        </CardHeader>
      </Card>

      {/* Override toggle */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{t("settings.customizeForSite")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {customized
                  ? t("settings.siteOverride")
                  : t("settings.inheritedFromParent")}
              </p>
            </div>
            <Switch checked={customized} onCheckedChange={setCustomized} />
          </div>
        </CardContent>
      </Card>

      {/* When NOT customized, show read-only inherited values */}
      {!customized && (
        <Card className="border-dashed">
          <CardContent className="pt-6 space-y-4">
            <Badge variant="secondary" className="text-xs gap-1.5">
              <RotateCcw className="h-3 w-3" />
              {t("settings.inheritedFromParent")}
            </Badge>
            <div className="grid gap-2 sm:grid-cols-2 text-sm">
              {effective.business_name && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" /> {effective.business_name}
                </div>
              )}
              {effective.business_email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" /> {effective.business_email}
                </div>
              )}
              {effective.business_phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" /> {effective.business_phone}
                </div>
              )}
              {effective.business_address && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {effective.business_address}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 pt-1">
              {[effective.primary_color, effective.secondary_color, effective.accent_color].filter(Boolean).map((c) => (
                <div key={c} className="flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded-full border border-border" style={{ backgroundColor: c }} />
                  <span className="text-xs text-muted-foreground font-mono">{c}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* When customized, show editable form */}
      {customized && (
        <>
          {/* Business details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-serif">{t("settings.businessDetails")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {(["business_name", "business_email", "business_phone", "business_address"] as const).map((key) => {
                  const labelMap: Record<string, string> = {
                    business_name: "common.name",
                    business_email: "common.email",
                    business_phone: "common.phone",
                    business_address: "common.address",
                  };
                  return (
                    <div key={key} className="space-y-2">
                      <Label>{tDynamic(labelMap[key])}</Label>
                      <div className="flex gap-1.5">
                        <Input
                          value={form[key]}
                          onChange={(e) => updateField(key, e.target.value)}
                          placeholder={(tenantSettings as any)?.[key] ?? ""}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 shrink-0"
                          title={t("settings.useParentDefault")}
                          onClick={() => resetFieldToParent(key)}
                        >
                          <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2">
                <Label>{t("common.description")}</Label>
                <Textarea
                  rows={3}
                  value={form.business_description}
                  onChange={(e) => updateField("business_description", e.target.value)}
                  placeholder={tenantSettings?.business_description ?? ""}
                />
              </div>
            </CardContent>
          </Card>

          {/* Brand colors */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-serif flex items-center gap-2">
                <Palette className="h-4 w-4" /> {t("settings.brandColors")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Presets */}
              <div className="space-y-2">
                <Label>{t("settings.presets")}</Label>
                <div className="flex flex-wrap gap-2">
                  {SITE_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => setForm((prev) => ({ ...prev, primary_color: preset.primary, secondary_color: preset.secondary, accent_color: preset.accent }))}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border hover:bg-secondary/50 transition-colors text-sm"
                    >
                      <span className="flex gap-0.5">
                        <span className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: preset.primary }} />
                        <span className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: preset.accent }} />
                      </span>
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {(["primary_color", "secondary_color", "accent_color"] as const).map((key) => {
                  const labelKey = key === "primary_color" ? "settings.primary" : key === "secondary_color" ? "settings.secondary" : "settings.accent";
                  return (
                    <div key={key} className="space-y-2">
                      <Label>{tDynamic(labelKey)}</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={form[key] || (tenantSettings as any)?.[key] || "#000000"}
                          onChange={(e) => updateField(key, e.target.value)}
                          className="h-10 w-10 rounded border border-border cursor-pointer"
                        />
                        <Input
                          value={form[key]}
                          onChange={(e) => updateField(key, e.target.value)}
                          className="font-mono text-sm"
                          placeholder={(tenantSettings as any)?.[key] ?? ""}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 shrink-0"
                          title={t("settings.useParentDefault")}
                          onClick={() => resetFieldToParent(key)}
                        >
                          <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label>{t("settings.preview")}</Label>
                <div className="rounded-lg border border-border p-4" style={{ backgroundColor: form.secondary_color || tenantSettings?.secondary_color || "#f5f0e8" }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-8 w-8 rounded-full" style={{ backgroundColor: form.primary_color || tenantSettings?.primary_color || "#1e3a5f" }} />
                    <span className="font-serif font-bold" style={{ color: form.primary_color || tenantSettings?.primary_color || "#1e3a5f" }}>
                      {form.business_name || effective.business_name || site.name}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-4 py-2 rounded-md text-sm font-medium text-white" style={{ backgroundColor: form.primary_color || tenantSettings?.primary_color || "#1e3a5f" }}>
                      {t("settings.primaryBtn")}
                    </button>
                    <button className="px-4 py-2 rounded-md text-sm font-medium text-white" style={{ backgroundColor: form.accent_color || tenantSettings?.accent_color || "#d4a853" }}>
                      {t("settings.accentBtn")}
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save button for site overrides */}
          <div className="flex justify-end">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t("common.saving")}
                </>
              ) : (
                t("common.save")
              )}
            </Button>
          </div>
        </>
      )}

      {/* Revert button when using defaults but overrides existed */}
      {!customized && hasOverrides && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-2" />
            )}
            {t("settings.useParentDefault")}
          </Button>
        </div>
      )}

      {/* Site-specific opening hours */}
      <OpeningHoursSettings siteId={siteId} />
    </div>
  );
};

const COLOR_PRESETS = [
  { name: "Navy & Amber", primary: "#1e3a5f", secondary: "#f5f0e8", accent: "#d4a853" },
  { name: "Forest & Gold", primary: "#2d5016", secondary: "#f0f4ec", accent: "#c8a951" },
  { name: "Burgundy & Cream", primary: "#722f37", secondary: "#faf5f0", accent: "#d4a853" },
  { name: "Slate & Coral", primary: "#334155", secondary: "#f8fafc", accent: "#f97316" },
  { name: "Indigo & Rose", primary: "#3730a3", secondary: "#f5f3ff", accent: "#e11d48" },
];

const SubscriptionCard = ({ tenant }: { tenant: any }) => {
  const t = useT();
  const [loading, setLoading] = useState(false);

  const tierLabel = tenant?.tier === "professional" ? "Pro" : tenant?.tier === "business" ? "Business" : "Basic";
  const statusLabel = tenant?.subscription_status === "trialing" ? "Trial" : tenant?.subscription_status === "active" ? "Active" : tenant?.subscription_status ?? "—";

  const handleManage = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) {
        // Parse the error body for a friendly message
        const errorBody = typeof error === "object" && "message" in error ? error.message : String(error);
        if (errorBody.includes("No Stripe customer")) {
          toast.info("No active subscription yet. Choose a plan to get started!", {
            action: {
              label: "View Plans",
              onClick: () => window.open("/pricing", "_blank"),
            },
          });
        } else {
          toast.error(errorBody || "Failed to open subscription portal");
        }
        return;
      }
      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        toast.info("No active subscription yet. Choose a plan to get started!", {
          action: {
            label: "View Plans",
            onClick: () => window.open("/pricing", "_blank"),
          },
        });
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("No Stripe customer") || msg.includes("non-2xx")) {
        toast.info("No active subscription yet. Choose a plan to get started!", {
          action: {
            label: "View Plans",
            onClick: () => window.open("/pricing", "_blank"),
          },
        });
      } else {
        toast.error(msg || "Failed to open subscription portal");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-serif flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          {"Subscription"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Crown className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="font-medium text-foreground">{tierLabel}</p>
              <p className="text-xs text-muted-foreground capitalize">{statusLabel}</p>
            </div>
          </div>
          <Badge variant={tenant?.subscription_status === "active" ? "default" : "secondary"} className="text-xs">
            {statusLabel}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleManage} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
            {"Manage Subscription"}
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href="/pricing" target="_blank" rel="noopener noreferrer" className="gap-1.5">
              {"View Plans"}
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_HERO_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const ALLOWED_HERO_TYPES = ["image/png", "image/jpeg", "image/webp"];

const SettingsPanel = () => {
  const { tenantId, tenant } = useTenant();
  const { isMultiSite } = useTierGate();
  const { selectedSiteId } = useSiteContext();
  const t = useT();
  const tDynamic = useTDynamic();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);

  const { data: settings, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["tenant-settings", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("tenant_settings")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const [form, setForm] = useState({
    business_name: "",
    business_description: "",
    business_email: "",
    business_phone: "",
    business_address: "",
    primary_color: "#1e3a5f",
    secondary_color: "#f5f0e8",
    accent_color: "#d4a853",
    logo_url: "",
    hero_image_url: "",
  });

  const DEFAULT_THRESHOLDS: Record<string, number> = { restaurant: 5, venue: 5, guesthouse: 5, hotel: 5 };
  const [thresholds, setThresholds] = useState<Record<string, number>>(DEFAULT_THRESHOLDS);
  const [resourceTypeNames, setResourceTypeNames] = useState<Record<string, string>>({});
  const [resourceTypeDescriptions, setResourceTypeDescriptions] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings) {
      setForm({
        business_name: settings.business_name ?? "",
        business_description: settings.business_description ?? "",
        business_email: settings.business_email ?? "",
        business_phone: settings.business_phone ?? "",
        business_address: settings.business_address ?? "",
        primary_color: settings.primary_color ?? "#1e3a5f",
        secondary_color: settings.secondary_color ?? "#f5f0e8",
        accent_color: settings.accent_color ?? "#d4a853",
        logo_url: settings.logo_url ?? "",
        hero_image_url: settings.hero_image_url ?? "",
      });
      if (settings.availability_thresholds && typeof settings.availability_thresholds === "object") {
        setThresholds({ ...DEFAULT_THRESHOLDS, ...(settings.availability_thresholds as Record<string, number>) });
      }
      if (settings.resource_type_names && typeof settings.resource_type_names === "object") {
        setResourceTypeNames(settings.resource_type_names as Record<string, string>);
      }
      if (settings.resource_type_descriptions && typeof settings.resource_type_descriptions === "object") {
        setResourceTypeDescriptions(settings.resource_type_descriptions as Record<string, string>);
      }
    }
  }, [settings, dataUpdatedAt]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(t("settings.logoInvalidType"));
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      toast.error(t("settings.logoTooLarge"));
      return;
    }

    setUploading(true);
    try {
      const { sanitizeFileExtension, sanitizePathSegment } = await import("@/lib/sanitize-path");
      const ext = sanitizeFileExtension(file.name.split(".").pop());
      const safeTenant = sanitizePathSegment(tenantId!);
      const filePath = `${safeTenant}/logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("tenant-branding")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("tenant-branding")
        .getPublicUrl(filePath);

      // Add cache-buster to force refresh
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setForm((prev) => ({ ...prev, logo_url: publicUrl }));
      toast.success(t("settings.logoUploaded"));
    } catch (err) {
      toast.error(t("settings.logoUploadError"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeLogo = () => setForm((prev) => ({ ...prev, logo_url: "" }));

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;

    if (!ALLOWED_HERO_TYPES.includes(file.type)) {
      toast.error(t("settings.logoInvalidType"));
      return;
    }
    if (file.size > MAX_HERO_SIZE) {
      toast.error(t("settings.logoTooLarge"));
      return;
    }

    setUploadingHero(true);
    try {
      const { sanitizeFileExtension, sanitizePathSegment } = await import("@/lib/sanitize-path");
      const ext = sanitizeFileExtension(file.name.split(".").pop());
      const safeTenant = sanitizePathSegment(tenantId!);
      const filePath = `${safeTenant}/hero.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("tenant-branding")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("tenant-branding")
        .getPublicUrl(filePath);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setForm((prev) => ({ ...prev, hero_image_url: publicUrl }));
      toast.success(t("settings.heroImageUploaded"));
    } catch (err) {
      toast.error(t("settings.heroImageUploadError"));
    } finally {
      setUploadingHero(false);
      if (heroInputRef.current) heroInputRef.current.value = "";
    }
  };

  const removeHero = () => setForm((prev) => ({ ...prev, hero_image_url: "" }));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant found");

      const payload = {
        tenant_id: tenantId,
        business_name: form.business_name || null,
        business_description: form.business_description || null,
        business_email: form.business_email || null,
        business_phone: form.business_phone || null,
        business_address: form.business_address || null,
        primary_color: form.primary_color,
        secondary_color: form.secondary_color,
        accent_color: form.accent_color,
        logo_url: form.logo_url || null,
        hero_image_url: form.hero_image_url || null,
        availability_thresholds: thresholds as any,
        resource_type_names: resourceTypeNames as any,
        resource_type_descriptions: resourceTypeDescriptions as any,
      };

      const { error } = settings?.id
        ? await supabase
            .from("tenant_settings")
            .update(payload)
            .eq("id", settings.id)
            .eq("tenant_id", tenantId)
        : await supabase
            .from("tenant_settings")
            .upsert(payload, { onConflict: "tenant_id" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-settings"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["tenant-settings-resource-names"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["tenant-settings-business"] });
      toast.success(t("settings.saved"));
    },
    onError: (error: any) => {
      toast.error(error?.message || t("settings.saveError"));
    },
  });

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const applyPreset = (preset: typeof COLOR_PRESETS[0]) => {
    setForm((prev) => ({
      ...prev,
      primary_color: preset.primary,
      secondary_color: preset.secondary,
      accent_color: preset.accent,
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div data-tour="settings-panel" className="space-y-6 max-w-3xl pb-20">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-serif font-bold text-foreground">{t("nav.settings")}</h2>
        <DashboardTooltip text="Customize your branding, business info, colors, and email templates. Changes apply to your public booking page instantly." />
      </div>

      {/* Site Tabs */}
      <SiteTabs />

      {/* Site-specific info when a site is selected */}
      {selectedSiteId && (
        <>
          <SiteSettingsInfo siteId={selectedSiteId} tenantId={tenantId!} />
          {/* Site-level email template overrides (Business tier only, superadmin bypasses) */}
          {isMultiSite && (
            <EmailTemplateEditor siteId={selectedSiteId} />
          )}
        </>
      )}

      {/* Tenant-level settings (only when "All Sites" is selected) */}
      {!selectedSiteId && (<>
      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-serif">{t("settings.logo")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {form.logo_url ? (
              <div className="relative">
                <img
                  src={form.logo_url}
                  alt="Logo"
                  className="h-20 w-20 rounded-lg object-contain border border-border bg-white p-1"
                />
                <button
                  type="button"
                  onClick={removeLogo}
                  className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="h-20 w-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-secondary/30">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {t("settings.uploading")}
                  </>
                ) : (
                  t("settings.uploadLogo")
                )}
              </Button>
              <p className="text-xs text-muted-foreground">{t("settings.logoHint")}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hero Image */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-serif">{t("settings.heroImage")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.hero_image_url ? (
            <div className="relative">
              <img
                src={form.hero_image_url}
                alt="Hero"
                className="w-full max-h-48 rounded-lg object-cover border border-border"
              />
              <button
                type="button"
                onClick={removeHero}
                className="absolute top-2 right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="w-full h-32 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 bg-secondary/30">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">1600 × 600 px</span>
            </div>
          )}
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => heroInputRef.current?.click()}
              disabled={uploadingHero}
            >
              {uploadingHero ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t("settings.uploading")}
                </>
              ) : (
                t("settings.uploadHeroImage")
              )}
            </Button>
            <p className="text-xs text-muted-foreground">{t("settings.heroImageHint")}</p>
            <input
              ref={heroInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleHeroUpload}
            />
          </div>
        </CardContent>
      </Card>

      {/* Business Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-serif">{t("settings.businessDetails")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="business_name">{t("common.name")}</Label>
              <Input id="business_name" value={form.business_name} onChange={(e) => updateField("business_name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_email">{t("common.email")}</Label>
              <Input id="business_email" type="email" value={form.business_email} onChange={(e) => updateField("business_email", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_phone">{t("common.phone")}</Label>
              <Input id="business_phone" value={form.business_phone} onChange={(e) => updateField("business_phone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_address">{t("common.address")}</Label>
              <Input id="business_address" value={form.business_address} onChange={(e) => updateField("business_address", e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="business_description">{t("common.description")}</Label>
            <Textarea id="business_description" rows={3} value={form.business_description} onChange={(e) => updateField("business_description", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Brand Colors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-serif">{t("settings.brandColors")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Presets */}
          <div className="space-y-2">
            <Label>{t("settings.presets")}</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border hover:bg-secondary/50 transition-colors text-sm"
                >
                  <span className="flex gap-0.5">
                    <span className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: preset.primary }} />
                    <span className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: preset.accent }} />
                  </span>
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Color Pickers */}
          <div className="grid gap-4 sm:grid-cols-3">
            {(["primary_color", "secondary_color", "accent_color"] as const).map((key) => (
              <div key={key} className="space-y-2">
                <Label>{t(`settings.${key === "primary_color" ? "primary" : key === "secondary_color" ? "secondary" : "accent"}`)}</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form[key]}
                    onChange={(e) => updateField(key, e.target.value)}
                    className="h-10 w-10 rounded border border-border cursor-pointer"
                  />
                  <Input
                    value={form[key]}
                    onChange={(e) => updateField(key, e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>{t("settings.preview")}</Label>
            <div className="rounded-lg border border-border p-4" style={{ backgroundColor: form.secondary_color }}>
              <div className="flex items-center gap-3 mb-3">
                {form.logo_url ? (
                  <img src={form.logo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded-full" style={{ backgroundColor: form.primary_color }} />
                )}
                <span className="font-serif font-bold" style={{ color: form.primary_color }}>
                  {form.business_name || "Your Business"}
                </span>
              </div>
              <div className="flex gap-2">
                <button className="px-4 py-2 rounded-md text-sm font-medium text-white" style={{ backgroundColor: form.primary_color }}>
                  {t("settings.primaryBtn")}
                </button>
                <button className="px-4 py-2 rounded-md text-sm font-medium text-white" style={{ backgroundColor: form.accent_color }}>
                  {t("settings.accentBtn")}
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Templates — tenant level */}
      <EmailTemplateEditor />

      {/* Opening Hours — tenant defaults */}
      <OpeningHoursSettings />

      {/* Discount Codes */}
      <DiscountCodesPanel />


      {/* Reservation Types — toggle which types this tenant offers */}
      <ReservationTypesCard />

      {/* Resource Type Names & Descriptions */}
      {tenant?.allowed_reservation_types?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-serif">{t("settings.resourceTypeNames")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("settings.resourceTypeNamesDesc")}</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {(tenant.allowed_reservation_types as string[]).map((type: string) => (
              <div key={type} className="space-y-3">
                <Label className="capitalize font-semibold">{tDynamic(`dashboard.${type}`)}</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t("common.name")}</Label>
                    <Input
                      value={resourceTypeNames[type] ?? ""}
                      onChange={(e) => setResourceTypeNames((prev) => ({ ...prev, [type]: e.target.value }))}
                      placeholder={tDynamic(`dashboard.${type}`)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t("common.description")}</Label>
                    <Input
                      value={resourceTypeDescriptions[type] ?? ""}
                      onChange={(e) => setResourceTypeDescriptions((prev) => ({ ...prev, [type]: e.target.value }))}
                      placeholder={t("settings.resourceTypeDescPlaceholder")}
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Availability Thresholds */}
      {tenant?.allowed_reservation_types?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-serif">{t("settings.availabilityThresholds")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("settings.availabilityThresholdsDesc")}</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(tenant.allowed_reservation_types as string[]).map((type: string) => (
                <div key={type} className="space-y-2">
                  <Label className="capitalize">{tDynamic(`dashboard.${type}`)}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={thresholds[type] ?? 5}
                      onChange={(e) => setThresholds((prev) => ({ ...prev, [type]: parseInt(e.target.value) || 5 }))}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">{t("booking.reservations")}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subscription Management */}
      <SubscriptionCard tenant={tenant} />

      {/* Redeem Access Code */}
      <RedeemAccessCode />

      {/* Multisite Upsell for non-business tiers (hidden for superadmins) */}
      {!isMultiSite && tenant?.tier && (
        <Card className="border-accent/30 bg-gradient-to-br from-accent/5 via-card to-accent/10">
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-6">
            <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-accent/15 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-accent" />
            </div>
            <div className="flex-1">
              <h3 className="font-serif font-bold text-foreground mb-1">
                {t("settings.upsellTitle")}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("settings.upsellDesc")}
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 whitespace-nowrap border-accent/40 text-accent hover:bg-accent/10 hover:text-accent">
              {t("settings.learnMore")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Save — sticky bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-sm py-3 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto flex justify-end">
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} size="lg">
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t("common.saving")}
              </>
            ) : (
              t("common.save")
            )}
          </Button>
        </div>
      </div>
      </>)}
    </div>
  );
};

export default SettingsPanel;
