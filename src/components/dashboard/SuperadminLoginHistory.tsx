import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, Monitor, Smartphone, Globe, CalendarIcon, X } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";

function parseDevice(ua: string | null) {
  if (!ua) return { icon: Globe, label: "Unknown" };
  if (/mobile|android|iphone|ipad/i.test(ua)) return { icon: Smartphone, label: "Mobile" };
  return { icon: Monitor, label: "Desktop" };
}

function parseBrowser(ua: string | null) {
  if (!ua) return "Unknown";
  if (/edg/i.test(ua)) return "Edge";
  if (/chrome/i.test(ua)) return "Chrome";
  if (/firefox/i.test(ua)) return "Firefox";
  if (/safari/i.test(ua)) return "Safari";
  return "Other";
}

const PAGE_SIZE = 25;

const SuperadminLoginHistory = () => {
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [page, setPage] = useState(0);

  const hasFilters = !!dateFrom || !!dateTo;

  const resetFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setPage(0);
  };

  // Fetch tenant names for display
  const { data: tenantMap } = useQuery({
    queryKey: ["superadmin-tenant-names"],
    queryFn: async () => {
      const { data } = await supabase.from("tenants_public" as any).select("id, name");
      return new Map((data ?? []).map((t) => [t.id, t.name]));
    },
  });

  // Fetch user display names
  const { data: userMap } = useQuery({
    queryKey: ["superadmin-user-names"],
    queryFn: async () => {
      const { data } = await supabase.from("tenant_users").select("user_id, display_name");
      return new Map((data ?? []).map((u) => [u.user_id, u.display_name]));
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["superadmin-login-history", dateFrom?.toISOString(), dateTo?.toISOString(), page],
    queryFn: async () => {
      let query = supabase
        .from("login_history")
        .select("*")
        .order("logged_in_at", { ascending: false });

      if (dateFrom) query = query.gte("logged_in_at", startOfDay(dateFrom).toISOString());
      if (dateTo) query = query.lte("logged_in_at", endOfDay(dateTo).toISOString());

      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

      const { data: logins, error } = await query;
      if (error) throw error;

      const hasMore = (logins?.length ?? 0) > PAGE_SIZE;
      const trimmed = hasMore ? logins!.slice(0, PAGE_SIZE) : (logins ?? []);

      return { entries: trimmed, hasMore };
    },
  });

  const entries = data?.entries ?? [];
  const hasMore = data?.hasMore ?? false;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <CardTitle className="font-serif">Platform Login History</CardTitle>
            {entries.length > 0 && (
              <span className="text-xs text-muted-foreground">{entries.length} entries</span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs", dateFrom && "border-primary/50")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateFrom ? format(dateFrom, "dd.MM.yyyy") : "From"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); setPage(0); }} disabled={(d) => (dateTo ? d > dateTo : false)} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs", dateTo && "border-primary/50")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateTo ? format(dateTo, "dd.MM.yyyy") : "To"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); setPage(0); }} disabled={(d) => (dateFrom ? d < dateFrom : false)} initialFocus className="p-3 pointer-events-auto" />
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
              <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {hasFilters ? "No logins match the selected filters." : "No login history yet."}
          </p>
        ) : (
          <>
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Device</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const device = parseDevice(entry.user_agent);
                    const DeviceIcon = device.icon;
                    const browser = parseBrowser(entry.user_agent);
                    const loginDate = new Date(entry.logged_in_at);

                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {format(loginDate, "d.M.yyyy HH:mm")}
                        </TableCell>
                        <TableCell className="font-medium">
                          {tenantMap?.get(entry.tenant_id) ?? entry.tenant_id.slice(0, 8) + "…"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {userMap?.get(entry.user_id) ?? entry.user_id.slice(0, 8) + "…"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs gap-1">
                            <DeviceIcon className="h-3 w-3" />
                            {browser}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Page {page + 1}{hasFilters ? " (filtered)" : ""}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>
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

export default SuperadminLoginHistory;
