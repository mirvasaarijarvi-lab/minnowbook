import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useT } from "@/contexts/I18nContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, Monitor, Smartphone, Globe, CalendarIcon, X } from "lucide-react";
import { format, formatDistanceToNow, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import DashboardTooltip from "./DashboardTooltip";

interface LoginEntry {
  id: string;
  user_id: string;
  user_agent: string | null;
  logged_in_at: string;
  display_name?: string;
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

const PAGE_SIZE = 25;

const LoginHistoryPanel = () => {
  const { tenantId } = useTenant();
  const t = useT();
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [page, setPage] = useState(0);

  const resetFilters = useCallback(() => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setSelectedUserId("all");
    setPage(0);
  }, []);

  // Fetch tenant users for the user filter dropdown
  const { data: tenantUsers } = useQuery({
    queryKey: ["tenant-users-for-filter", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tenant_users")
        .select("user_id, display_name")
        .order("display_name");
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["login-history", tenantId, dateFrom?.toISOString(), dateTo?.toISOString(), selectedUserId, page],
    queryFn: async () => {
      let query = supabase
        .from("login_history")
        .select("*")
        .order("logged_in_at", { ascending: false });

      if (dateFrom) {
        query = query.gte("logged_in_at", startOfDay(dateFrom).toISOString());
      }
      if (dateTo) {
        query = query.lte("logged_in_at", endOfDay(dateTo).toISOString());
      }
      if (selectedUserId !== "all") {
        query = query.eq("user_id", selectedUserId);
      }

      // Fetch one extra to detect next page
      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

      const { data: logins, error } = await query;
      if (error) throw error;

      const hasMore = (logins?.length ?? 0) > PAGE_SIZE;
      const trimmedLogins = hasMore ? logins!.slice(0, PAGE_SIZE) : (logins ?? []);

      const userMap = new Map(
        (tenantUsers ?? []).map((u) => [u.user_id, u.display_name])
      );

      const entries = trimmedLogins.map((l) => ({
        ...l,
        display_name: userMap.get(l.user_id) ?? undefined,
      })) as LoginEntry[];

      return { entries, hasMore };
    },
    enabled: !!tenantId,
  });

  const loginHistory = data?.entries;
  const hasMore = data?.hasMore ?? false;
  const hasFilters = !!dateFrom || !!dateTo || selectedUserId !== "all";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <CardTitle className="font-serif">{t("admin.loginHistory")}</CardTitle>
            <DashboardTooltip text="Recent login activity for all team members in your organisation." />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* User filter */}
            <Select value={selectedUserId} onValueChange={(v) => { setSelectedUserId(v); setPage(0); }}>
              <SelectTrigger className={cn("w-[160px] h-8 text-xs", selectedUserId !== "all" && "border-primary/50")}>
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {(tenantUsers ?? []).map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    {u.display_name || u.user_id.slice(0, 8) + "…"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date from */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs", dateFrom && "border-primary/50")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateFrom ? format(dateFrom, "dd.MM.yyyy") : "From"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={(d) => { setDateFrom(d); setPage(0); }}
                  disabled={(d) => (dateTo ? d > dateTo : false)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            {/* Date to */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs", dateTo && "border-primary/50")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateTo ? format(dateTo, "dd.MM.yyyy") : "To"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={(d) => { setDateTo(d); setPage(0); }}
                  disabled={(d) => (dateFrom ? d < dateFrom : false)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 text-xs text-muted-foreground">
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
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
            {hasFilters ? "No entries match the selected filters." : t("admin.noLoginHistory")}
          </p>
        ) : (
          <>
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

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Page {page + 1}{hasFilters ? " (filtered)" : ""}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasMore}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default LoginHistoryPanel;
