import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useT } from "@/contexts/I18nContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, Monitor, Smartphone, Globe } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import DashboardTooltip from "./DashboardTooltip";

interface LoginEntry {
  id: string;
  user_id: string;
  user_agent: string | null;
  logged_in_at: string;
  display_name?: string;
  email?: string;
}

function parseDevice(ua: string | null): { icon: typeof Monitor; label: string } {
  if (!ua) return { icon: Globe, label: "Unknown" };
  if (/mobile|android|iphone|ipad/i.test(ua)) return { icon: Smartphone, label: "Mobile" };
  return { icon: Monitor, label: "Desktop" };
}

function parseBrowser(ua: string | null): string {
  if (!ua) return "Unknown";
  if (/edg/i.test(ua)) return "Edge";
  if (/chrome/i.test(ua)) return "Chrome";
  if (/firefox/i.test(ua)) return "Firefox";
  if (/safari/i.test(ua)) return "Safari";
  return "Other";
}

const LoginHistoryPanel = () => {
  const { tenantId } = useTenant();
  const t = useT();

  const { data: loginHistory, isLoading } = useQuery({
    queryKey: ["login-history", tenantId],
    queryFn: async () => {
      // Fetch login history
      const { data: logins, error } = await supabase
        .from("login_history")
        .select("*")
        .order("logged_in_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch user display names from tenant_users
      const { data: tenantUsers } = await supabase
        .from("tenant_users")
        .select("user_id, display_name");

      const userMap = new Map(
        (tenantUsers ?? []).map((u) => [u.user_id, u.display_name])
      );

      return (logins ?? []).map((l) => ({
        ...l,
        display_name: userMap.get(l.user_id) ?? undefined,
      })) as LoginEntry[];
    },
    enabled: !!tenantId,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <CardTitle className="font-serif">{t("admin.loginHistory")}</CardTitle>
          <DashboardTooltip text="Recent login activity for all team members in your organisation." />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : !loginHistory?.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {t("admin.noLoginHistory")}
          </p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {loginHistory.map((entry) => {
              const device = parseDevice(entry.user_agent);
              const DeviceIcon = device.icon;
              const browser = parseBrowser(entry.user_agent);
              const loginDate = new Date(entry.logged_in_at);

              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <DeviceIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {entry.display_name || entry.user_id.slice(0, 8) + "…"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {browser} · {device.label}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(loginDate, { addSuffix: true })}
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      {format(loginDate, "dd.MM.yyyy HH:mm")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LoginHistoryPanel;
