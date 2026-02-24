import { useState, useEffect } from "react";
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
import { Loader2 } from "lucide-react";

const COLOR_PRESETS = [
  { name: "Navy & Amber", primary: "#1e3a5f", secondary: "#f5f0e8", accent: "#d4a853" },
  { name: "Forest & Gold", primary: "#2d5016", secondary: "#f0f4ec", accent: "#c8a951" },
  { name: "Burgundy & Cream", primary: "#722f37", secondary: "#faf5f0", accent: "#d4a853" },
  { name: "Slate & Coral", primary: "#334155", secondary: "#f8fafc", accent: "#f97316" },
  { name: "Indigo & Rose", primary: "#3730a3", secondary: "#f5f3ff", accent: "#e11d48" },
];

const SettingsPanel = () => {
  const { tenantId } = useTenant();
  const t = useT();
  const queryClient = useQueryClient();

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
  });

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
      });
    }
  }, [settings]);

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
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-2xl font-serif font-bold text-foreground">{t("nav.settings")}</h2>

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
                <div className="h-8 w-8 rounded-full" style={{ backgroundColor: form.primary_color }} />
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
