import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useT } from "@/contexts/I18nContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Mail, Lock, Eye, EyeOff, RotateCcw, Info } from "lucide-react";
import DashboardTooltip from "./DashboardTooltip";
import DOMPurify from "dompurify";

const TEMPLATE_TYPES = ["confirmation", "reminder", "cancellation"] as const;
type TemplateType = typeof TEMPLATE_TYPES[number];

const LANGUAGES = ["en", "fi", "sv"] as const;
type Language = typeof LANGUAGES[number];

interface TemplateForm {
  subject: string;
  body_html: string;
  is_active: boolean;
}

const DEFAULT_TEMPLATES: Record<TemplateType, Record<Language, { subject: string; body_html: string }>> = {
  confirmation: {
    en: {
      subject: "Your reservation has been confirmed",
      body_html: "<p>Dear {{guest_name}},</p>\n<p>Your reservation on <strong>{{date}}</strong> has been confirmed.</p>\n<p>We look forward to welcoming you!</p>",
    },
    fi: {
      subject: "Varauksesi on vahvistettu",
      body_html: "<p>Hyvä {{guest_name}},</p>\n<p>Varauksesi <strong>{{date}}</strong> on vahvistettu.</p>\n<p>Toivotamme sinut tervetulleeksi!</p>",
    },
    sv: {
      subject: "Din bokning har bekräftats",
      body_html: "<p>Kära {{guest_name}},</p>\n<p>Din bokning den <strong>{{date}}</strong> har bekräftats.</p>\n<p>Vi ser fram emot att välkomna dig!</p>",
    },
  },
  reminder: {
    en: {
      subject: "Reminder: Your upcoming reservation",
      body_html: "<p>Dear {{guest_name}},</p>\n<p>This is a friendly reminder about your upcoming reservation on <strong>{{date}}</strong>.</p>\n<p>We look forward to seeing you!</p>",
    },
    fi: {
      subject: "Muistutus: Tuleva varauksesi",
      body_html: "<p>Hyvä {{guest_name}},</p>\n<p>Tämä on ystävällinen muistutus tulevasta varauksestasi <strong>{{date}}</strong>.</p>\n<p>Odotamme innolla vierailuasi!</p>",
    },
    sv: {
      subject: "Påminnelse: Din kommande bokning",
      body_html: "<p>Kära {{guest_name}},</p>\n<p>Detta är en vänlig påminnelse om din kommande bokning den <strong>{{date}}</strong>.</p>\n<p>Vi ser fram emot att välkomna dig!</p>",
    },
  },
  cancellation: {
    en: {
      subject: "Your reservation has been cancelled",
      body_html: "<p>Dear {{guest_name}},</p>\n<p>We regret to inform you that your reservation on <strong>{{date}}</strong> has been cancelled.</p>\n<p>If you have any questions, please contact us.</p>",
    },
    fi: {
      subject: "Varauksesi on peruutettu",
      body_html: "<p>Hyvä {{guest_name}},</p>\n<p>Ilmoitamme, että varauksesi <strong>{{date}}</strong> on peruutettu.</p>\n<p>Jos sinulla on kysyttävää, ota meihin yhteyttä.</p>",
    },
    sv: {
      subject: "Din bokning har avbokats",
      body_html: "<p>Kära {{guest_name}},</p>\n<p>Vi beklagar att meddela att din bokning den <strong>{{date}}</strong> har avbokats.</p>\n<p>Kontakta oss om du har frågor.</p>",
    },
  },
};

const VARIABLES = [
  { key: "{{guest_name}}", desc: "Guest's full name" },
  { key: "{{guest_email}}", desc: "Guest's email" },
  { key: "{{date}}", desc: "Reservation date" },
  { key: "{{start_time}}", desc: "Start time" },
  { key: "{{reservation_type}}", desc: "Reservation type" },
  { key: "{{guests_count}}", desc: "Number of guests" },
  { key: "{{price_eur}}", desc: "Price (€)" },
  { key: "{{business_name}}", desc: "Your business name" },
];

const EmailTemplateEditor = () => {
  const t = useT();
  const { tenantId, tenant } = useTenant();
  const queryClient = useQueryClient();

  const tier = tenant?.tier || "basic";
  const isBasic = tier === "basic";

  const [selectedType, setSelectedType] = useState<TemplateType>("confirmation");
  const [selectedLang, setSelectedLang] = useState<Language>("en");
  const [form, setForm] = useState<TemplateForm>({ subject: "", body_html: "", is_active: true });
  const [showPreview, setShowPreview] = useState(false);

  // Fetch all templates for this tenant
  const { data: templates, isLoading } = useQuery({
    queryKey: ["email-templates", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("tenant_email_templates")
        .select("*")
        .eq("tenant_id", tenantId)
        .is("site_id", null);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Find current template
  const currentTemplate = templates?.find(
    (tmpl) => tmpl.template_type === selectedType && tmpl.language === selectedLang
  );

  // Sync form when selection changes
  useEffect(() => {
    if (currentTemplate) {
      setForm({
        subject: currentTemplate.subject,
        body_html: currentTemplate.body_html,
        is_active: currentTemplate.is_active ?? true,
      });
    } else {
      const defaults = DEFAULT_TEMPLATES[selectedType][selectedLang];
      setForm({ subject: defaults.subject, body_html: defaults.body_html, is_active: true });
    }
  }, [currentTemplate, selectedType, selectedLang]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant");
      const payload = {
        tenant_id: tenantId,
        template_type: selectedType,
        language: selectedLang,
        subject: form.subject,
        body_html: form.body_html,
        is_active: form.is_active,
        site_id: null,
      };
      if (currentTemplate) {
        const { error } = await supabase
          .from("tenant_email_templates")
          .update({ subject: form.subject, body_html: form.body_html, is_active: form.is_active })
          .eq("id", currentTemplate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tenant_email_templates")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates", tenantId] });
      toast.success(t("emailTemplates.saved"));
    },
    onError: (err: any) => {
      toast.error(err?.message || t("emailTemplates.saveError"));
    },
  });

  const resetToDefault = () => {
    const defaults = DEFAULT_TEMPLATES[selectedType][selectedLang];
    setForm({ subject: defaults.subject, body_html: defaults.body_html, is_active: true });
  };

  const typeLabels: Record<TemplateType, string> = {
    confirmation: t("emailTemplates.confirmation"),
    reminder: t("emailTemplates.reminder"),
    cancellation: t("emailTemplates.cancellation"),
  };

  const langLabels: Record<Language, string> = {
    en: "English",
    fi: "Suomi",
    sv: "Svenska",
  };

  // Preview with sample data
  const previewHtml = form.body_html
    .replace(/\{\{guest_name\}\}/g, "Jane Doe")
    .replace(/\{\{guest_email\}\}/g, "jane@example.com")
    .replace(/\{\{date\}\}/g, "2026-03-15")
    .replace(/\{\{start_time\}\}/g, "14:00")
    .replace(/\{\{reservation_type\}\}/g, "Restaurant")
    .replace(/\{\{guests_count\}\}/g, "4")
    .replace(/\{\{price_eur\}\}/g, "120.00")
    .replace(/\{\{business_name\}\}/g, tenant?.name || "Your Business");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-serif">{t("emailTemplates.title")}</CardTitle>
            <DashboardTooltip text={t("emailTemplates.tooltip")} />
          </div>
          {isBasic && (
            <Badge variant="secondary" className="gap-1.5 text-xs">
              <Lock className="h-3 w-3" />
              {t("emailTemplates.proRequired")}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{t("emailTemplates.description")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Template type tabs */}
        <Tabs value={selectedType} onValueChange={(v) => setSelectedType(v as TemplateType)}>
          <TabsList className="w-full grid grid-cols-3">
            {TEMPLATE_TYPES.map((type) => (
              <TabsTrigger key={type} value={type}>{typeLabels[type]}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Language selector */}
        <div className="flex items-center gap-3">
          <Label className="text-sm shrink-0">{t("emailTemplates.language")}</Label>
          <Select value={selectedLang} onValueChange={(v) => setSelectedLang(v as Language)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang} value={lang}>{langLabels[lang]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentTemplate && (
            <Badge variant={currentTemplate.is_active ? "default" : "secondary"} className="text-xs">
              {currentTemplate.is_active ? t("emailTemplates.active") : t("emailTemplates.inactive")}
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Subject */}
            <div className="space-y-2">
              <Label>{t("emailTemplates.subject")}</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                disabled={isBasic}
                placeholder={DEFAULT_TEMPLATES[selectedType][selectedLang].subject}
              />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("emailTemplates.body")}</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showPreview ? t("emailTemplates.hidePreview") : t("emailTemplates.showPreview")}
                </Button>
              </div>
              <Textarea
                rows={8}
                value={form.body_html}
                onChange={(e) => setForm((prev) => ({ ...prev, body_html: e.target.value }))}
                disabled={isBasic}
                placeholder={DEFAULT_TEMPLATES[selectedType][selectedLang].body_html}
                className="font-mono text-sm"
              />
            </div>

            {/* Preview */}
            {showPreview && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t("emailTemplates.previewLabel")}</Label>
                <div
                  className="rounded-lg border border-border p-4 bg-card text-sm prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml) }}
                />
              </div>
            )}

            {/* Available variables */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-xs text-muted-foreground">{t("emailTemplates.availableVars")}</Label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {VARIABLES.map((v) => (
                  <Badge key={v.key} variant="outline" className="text-xs font-mono cursor-help" title={v.desc}>
                    {v.key}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <Label className="text-sm">{t("emailTemplates.activeToggle")}</Label>
                <p className="text-xs text-muted-foreground">{t("emailTemplates.activeToggleDesc")}</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((prev) => ({ ...prev, is_active: v }))}
                disabled={isBasic}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={resetToDefault}
                disabled={isBasic}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t("emailTemplates.resetDefault")}
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={isBasic || saveMutation.isPending}
              >
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

            {isBasic && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                {t("emailTemplates.upgradeHint")}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default EmailTemplateEditor;
