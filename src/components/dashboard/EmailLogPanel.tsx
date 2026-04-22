import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, CheckCircle2, Clock, Mail, Search, XCircle, AlertTriangle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { color: string; icon: typeof CheckCircle2; label: string }> = {
  sent: { color: "text-green-600 bg-green-100 dark:bg-green-900/30", icon: CheckCircle2, label: "Sent" },
  pending: { color: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30", icon: Clock, label: "Pending" },
  failed: { color: "text-destructive bg-red-100 dark:bg-red-900/30", icon: XCircle, label: "Failed" },
  dlq: { color: "text-destructive bg-red-100 dark:bg-red-900/30", icon: XCircle, label: "Dead Letter" },
  suppressed: { color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30", icon: AlertTriangle, label: "Suppressed" },
  bounced: { color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30", icon: AlertTriangle, label: "Bounced" },
  complained: { color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30", icon: AlertTriangle, label: "Complained" },
};

interface EmailLogRow {
  id: string;
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

const EmailLogPanel = () => {
  const { tenantId } = useTenant();
  const [recipientQuery, setRecipientQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["email-send-log-tenant", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_send_log")
        .select("id, message_id, template_name, recipient_email, status, error_message, created_at")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as EmailLogRow[];
    },
  });

  // Deduplicate by message_id (latest row per email)
  const deduped = useMemo(() => {
    const map = new Map<string, EmailLogRow>();
    (logs ?? []).forEach((e) => {
      const key = e.message_id || e.id;
      const existing = map.get(key);
      if (!existing || new Date(e.created_at) > new Date(existing.created_at)) {
        map.set(key, e);
      }
    });
    return Array.from(map.values());
  }, [logs]);

  const filtered = useMemo(() => {
    const q = recipientQuery.trim().toLowerCase();
    const fromMs = fromDate ? new Date(fromDate.setHours(0, 0, 0, 0)).getTime() : null;
    const toMs = toDate ? new Date(new Date(toDate).setHours(23, 59, 59, 999)).getTime() : null;
    return deduped.filter((e) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (q && !e.recipient_email.toLowerCase().includes(q)) return false;
      const ts = new Date(e.created_at).getTime();
      if (fromMs !== null && ts < fromMs) return false;
      if (toMs !== null && ts > toMs) return false;
      return true;
    });
  }, [deduped, recipientQuery, statusFilter, fromDate, toDate]);

  const stats = useMemo(
    () => ({
      total: filtered.length,
      sent: filtered.filter((e) => e.status === "sent").length,
      pending: filtered.filter((e) => e.status === "pending").length,
      failed: filtered.filter((e) => ["failed", "dlq"].includes(e.status)).length,
    }),
    [filtered],
  );

  const clearAll = () => {
    setRecipientQuery("");
    setStatusFilter("all");
    setFromDate(undefined);
    setToDate(undefined);
  };

  const hasActiveFilters =
    recipientQuery.trim() !== "" || statusFilter !== "all" || fromDate || toDate;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-accent" />
          <CardTitle className="text-xl font-serif">Email Log</CardTitle>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="email-recipient" className="text-xs">Recipient</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="email-recipient"
                placeholder="Search email…"
                className="pl-8"
                value={recipientQuery}
                onChange={(e) => setRecipientQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="dlq">Dead Letter</SelectItem>
                <SelectItem value="suppressed">Suppressed</SelectItem>
                <SelectItem value="bounced">Bounced</SelectItem>
                <SelectItem value="complained">Complained</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">From</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !fromDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {fromDate ? format(fromDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fromDate}
                  onSelect={setFromDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !toDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {toDate ? format(toDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={toDate}
                  onSelect={setToDate}
                  disabled={(d) => (fromDate ? d < fromDate : false)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="text-center p-3 rounded-lg bg-secondary/50">
            <Mail className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-secondary/50">
            <CheckCircle2 className="h-4 w-4 mx-auto text-green-600 mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats.sent}</p>
            <p className="text-xs text-muted-foreground">Sent</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-secondary/50">
            <Clock className="h-4 w-4 mx-auto text-yellow-600 mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-secondary/50">
            <XCircle className="h-4 w-4 mx-auto text-destructive mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats.failed}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-6 w-6 border-4 border-accent border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">
            {deduped.length === 0 ? "No emails sent yet." : "No emails match these filters."}
          </p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {filtered.map((e) => {
              const cfg = statusConfig[e.status] || statusConfig.pending;
              const StatusIcon = cfg.icon;
              return (
                <div
                  key={e.id}
                  className="p-3 rounded-lg border border-border bg-card flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-[10px] ${cfg.color} border-0`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {cfg.label}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {e.template_name}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground truncate">{e.recipient_email}</p>
                    {e.error_message && (
                      <p className="text-[11px] text-destructive">{e.error_message}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    {format(new Date(e.created_at), "MMM d, HH:mm")}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EmailLogPanel;
