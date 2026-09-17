import { useMemo, useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { useT } from "@/contexts/I18nContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code2, Copy, MousePointerClick, Globe } from "lucide-react";
import { toast } from "sonner";
import DashboardTooltip from "./DashboardTooltip";

const Snippet = ({ code, onCopy, label }: { code: string; onCopy: () => void; label: string }) => (
  <div className="space-y-2">
    <pre className="max-w-full overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs font-mono text-foreground whitespace-pre-wrap break-all">
      {code}
    </pre>
    <Button variant="outline" size="sm" onClick={onCopy} className="gap-1.5">
      <Copy className="h-3.5 w-3.5" />
      {label}
    </Button>
  </div>
);

const ShareBookingPageCard = () => {
  const { tenant } = useTenant();
  const t = useT();
  const [tab, setTab] = useState("embed");

  const bookingUrl = tenant?.slug ? `${window.location.origin}/book/${tenant.slug}` : "";

  const embedCode = useMemo(
    () =>
      `<iframe src="${bookingUrl}?embed=1" title="${t("dashboard.shareIframeTitle")}" width="100%" height="900" loading="lazy" style="border:0;max-width:100%;display:block"></iframe>`,
    [bookingUrl, t],
  );

  const buttonCode = useMemo(
    () =>
      `<a href="${bookingUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 24px;border-radius:8px;background:#FF6B30;color:#fff;font-weight:600;text-decoration:none">${t("dashboard.shareButtonLabel")}</a>`,
    [bookingUrl, t],
  );

  if (!bookingUrl) return null;

  const copy = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success(t("dashboard.linkCopied"));
  };

  const copyLabel = t("dashboard.shareCopyCode");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          {t("dashboard.shareTitle")}
          <DashboardTooltip text={t("dashboard.shareDesc")} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("dashboard.shareDesc")}</p>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="embed" className="gap-1.5">
              <Code2 className="h-3.5 w-3.5" />
              {t("dashboard.shareTabEmbed")}
            </TabsTrigger>
            <TabsTrigger value="button" className="gap-1.5">
              <MousePointerClick className="h-3.5 w-3.5" />
              {t("dashboard.shareTabButton")}
            </TabsTrigger>
            <TabsTrigger value="domain" className="gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              {t("dashboard.shareTabDomain")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="embed" className="space-y-3 pt-4">
            <p className="text-sm text-muted-foreground">{t("dashboard.shareEmbedDesc")}</p>
            <Snippet code={embedCode} onCopy={() => copy(embedCode)} label={copyLabel} />
            <p className="text-xs text-muted-foreground">{t("dashboard.shareEmbedHint")}</p>
          </TabsContent>

          <TabsContent value="button" className="space-y-3 pt-4">
            <p className="text-sm text-muted-foreground">{t("dashboard.shareButtonDesc")}</p>
            <Snippet code={buttonCode} onCopy={() => copy(buttonCode)} label={copyLabel} />
            <p className="text-xs text-muted-foreground">{t("dashboard.shareButtonHint")}</p>
          </TabsContent>

          <TabsContent value="domain" className="space-y-3 pt-4">
            <p className="text-sm text-muted-foreground">{t("dashboard.shareDomainDesc")}</p>
            <ol className="space-y-1.5 pl-5 list-decimal text-sm text-muted-foreground">
              <li>{t("dashboard.shareDomainStep1")}</li>
              <li>{t("dashboard.shareDomainStep2")}</li>
              <li>{t("dashboard.shareDomainStep3")}</li>
            </ol>
            <Snippet code={bookingUrl} onCopy={() => copy(bookingUrl)} label={t("dashboard.shareCopyAddress")} />
            <p className="text-xs text-muted-foreground">{t("dashboard.shareDomainHint")}</p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ShareBookingPageCard;
