import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useSiteContext } from "@/hooks/useSiteContext";
import { useUserSites } from "@/hooks/useUserSites";
import { useT } from "@/contexts/I18nContext";
import { useDateLocale } from "@/hooks/useDateLocale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import DashboardTooltip from "./DashboardTooltip";

function getNextCronRun(): Date {
  const now = new Date();
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  if (next <= now) {
    next.setHours(next.getHours() + 1);
  }
  return next;
}

const AutoReminderStatus = () => {
  const t = useT();
  const { tenantId } = useTenant();
  const { selectedSiteId } = useSiteContext();
  const { applySiteFilter } = useUserSites();
  const dateFnsLocale = useDateLocale();

  const nextRun = getNextCronRun();

  // Fetch recently reminded reservations (last 7 days)
  const { data: recentReminders, isLoading } = useQuery({
    queryKey: ["recent-auto-reminders", tenantId, selectedSiteId],
    queryFn: async () => {
      if (!tenantId) return [];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      let query = supabase
        .from("reservations")
        .select("id, guest_name, guest_email, date, start_time, reservation_type, reminder_email_sent_at, site_id")
        .eq("tenant_id", tenantId)
        .not("reminder_email_sent_at", "is", null)
        .gte("reminder_email_sent_at", sevenDaysAgo.toISOString())
        .order("reminder_email_sent_at", { ascending: false })
        .limit(10);

      query = applySiteFilter(query, selectedSiteId);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
    refetchInterval: 60_000,
  });

  const reminderCount = recentReminders?.length ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-serif">{t("autoReminder.title")}</CardTitle>
            <DashboardTooltip text={t("autoReminder.tooltip")} />
          </div>
          <Badge variant="outline" className="gap-1.5 text-xs">
            <Clock className="h-3 w-3" />
            {t("autoReminder.hourly")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Next run indicator */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
          <div>
            <p className="text-sm font-medium text-foreground">{t("autoReminder.nextRun")}</p>
            <p className="text-xs text-muted-foreground">
              {format(nextRun, "HH:mm")} ({formatDistanceToNow(nextRun, { addSuffix: true, locale: dateFnsLocale })})
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
            </span>
            {t("autoReminder.active")}
          </div>
        </div>

        {/* Recent reminders log */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-foreground">{t("autoReminder.recentLog")}</p>
            <Badge variant="secondary" className="text-xs">
              {reminderCount} {t("autoReminder.sent7d")}
            </Badge>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : reminderCount === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("autoReminder.noRecent")}
            </p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {recentReminders!.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{r.guest_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.reservation_type} · {r.date}{r.start_time ? ` ${r.start_time.slice(0, 5)}` : ""}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                    {r.reminder_email_sent_at
                      ? formatDistanceToNow(new Date(r.reminder_email_sent_at), { addSuffix: true, locale: dateFnsLocale })
                      : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AutoReminderStatus;
