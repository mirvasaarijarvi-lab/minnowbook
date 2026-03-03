import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useT } from "@/contexts/I18nContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Upload, X, ImageIcon } from "lucide-react";
import DashboardTooltip from "./DashboardTooltip";
import OpeningHoursSettings from "./OpeningHoursSettings";

const COLOR_PRESETS = [
  { name: "Navy & Amber", primary: "#1e3a5f", secondary: "#f5f0e8", accent: "#d4a853" },
  { name: "Forest & Gold", primary: "#2d5016", secondary: "#f0f4ec", accent: "#c8a951" },
  { name: "Burgundy & Cream", primary: "#722f37", secondary: "#faf5f0", accent: "#d4a853" },
  { name: "Slate & Coral", primary: "#334155", secondary: "#f8fafc", accent: "#f97316" },
  { name: "Indigo & Rose", primary: "#3730a3", secondary: "#f5f3ff", accent: "#e11d48" },
];

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_HERO_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const ALLOWED_HERO_TYPES = ["image/png", "image/jpeg", "image/webp"];

const SettingsPanel = () => {
  const { tenantId, tenant } = useTenant();
  const t = useT();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);

  const { data: settings, isLoading } = useQuery({
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
  }, [settings]);

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
      const ext = file.name.split(".").pop();
      const filePath = `${tenantId}/logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("tenant-assets")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("tenant-assets")
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
      const ext = file.name.split(".").pop();
      const filePath = `${tenantId}/hero.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("tenant-assets")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("tenant-assets")
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
      if (!tenantId || !settings?.id) throw new Error("No settings found");
      const { error } = await supabase
        .from("tenant_settings")
        .update({
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
        })
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-settings"] });
      toast.success(t("settings.saved"));
    },
    onError: () => {
      toast.error(t("settings.saveError"));
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
    <div data-tour="settings-panel" className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-serif font-bold text-foreground">{t("nav.settings")}</h2>
        <DashboardTooltip text="Customize your branding, business info, colors, and email templates. Changes apply to your public booking page instantly." />
      </div>

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

      {/* Opening Hours */}
      <OpeningHoursSettings />

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
                <Label className="capitalize font-semibold">{t(`dashboard.${type}` as any)}</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t("common.name")}</Label>
                    <Input
                      value={resourceTypeNames[type] ?? ""}
                      onChange={(e) => setResourceTypeNames((prev) => ({ ...prev, [type]: e.target.value }))}
                      placeholder={t(`dashboard.${type}` as any)}
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
                  <Label className="capitalize">{t(`dashboard.${type}` as any)}</Label>
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

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
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
  );
};

export default SettingsPanel;
