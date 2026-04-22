import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useT } from "@/contexts/I18nContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  RefreshCw,
  ScrollText,
} from "lucide-react";
import DashboardTooltip from "./DashboardTooltip";
import { cn } from "@/lib/utils";

type Outcome = "accepted" | "soft_warning" | "rejected";

interface LogRow {
  id: string;
  created_at: string;
  source: string;
  reservation_type: string | null;
  reservation_date: string | null;
  start_time: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guests_requested: number | null;
  current_load: number | null;
  capacity_total: number | null;
  outcome: Outcome;
  reasons: string[] | null;
  reservation_id: string | null;
  site_id: string | null;
}

const OUTCOME_META: Record<Outcome, { label: string; icon: React.ElementType; cls: string }> = {
  accepted: {
    label: "Accepted",
    icon: CheckCircle2,
    cls: "bg-primary/10 text-primary border-primary/30",
  },
  soft_warning: {
    label: "Soft warning",
    icon: AlertTriangle,
    cls: "bg-warning/15 text-warning-foreground border-warning/30",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    cls: "bg-destructive/15 text-destructive border-destructive/40",
  },
};

const BookingValidationLogPanel = () => {
  const t = useT();
  const { tenantId } = useTenant();
  const [outcomeFilter, setOutcomeFilter] = useState<"all" | Outcome>("all");
  const [search, setSearch] = useState("");
  const [openRow, setOpenRow] = useState<string | null>(null);

  const { data = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["booking-validation-log", tenantId, outcomeFilter],
    enabled: !!tenantId,
    queryFn: async () => {
      let q = supabase
        .from("booking_validation_log")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (outcomeFilter !== "all") q = q.eq("outcome", outcomeFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const s = search.toLowerCase();
    return data.filter(
      (r) =>
        r.guest_name?.toLowerCase().includes(s) ||
        r.guest_email?.toLowerCase().includes(s) ||
        r.reservation_type?.toLowerCase().includes(s),
    );
  }, [data, search]);

  const counts = useMemo(() => {
    const byOutcome: Record<Outcome, number> = { accepted: 0, soft_warning: 0, rejected: 0 };
    for (const r of data) byOutcome[r.outcome]++;
    return byOutcome;
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-foreground">
            {t("bookingLog.title" as any)}
          </h2>
          <DashboardTooltip text={t("bookingLog.tooltip" as any)} />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          {t("common.loading" as any)}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {(Object.keys(OUTCOME_META) as Outcome[]).map((k) => {
          const meta = OUTCOME_META[k];
          const Icon = meta.icon;
          return (
            <Card key={k}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("p-2 rounded-md border", meta.cls)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{meta.label}</p>
                  <p className="text-xl font-semibold">{counts[k]}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("bookingLog.recentTitle" as any)}</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Input
              placeholder={t("bookingLog.searchPlaceholder" as any)}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 sm:max-w-xs"
            />
            <Select value={outcomeFilter} onValueChange={(v) => setOutcomeFilter(v as any)}>
              <SelectTrigger className="h-9 sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("bookingLog.allOutcomes" as any)}</SelectItem>
                <SelectItem value="accepted">{OUTCOME_META.accepted.label}</SelectItem>
                <SelectItem value="soft_warning">{OUTCOME_META.soft_warning.label}</SelectItem>
                <SelectItem value="rejected">{OUTCOME_META.rejected.label}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("bookingLog.empty" as any)}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">{t("bookingLog.when" as any)}</TableHead>
                    <TableHead>{t("bookingLog.guest" as any)}</TableHead>
                    <TableHead>{t("bookingLog.type" as any)}</TableHead>
                    <TableHead>{t("bookingLog.date" as any)}</TableHead>
                    <TableHead className="text-right">{t("bookingLog.capacity" as any)}</TableHead>
                    <TableHead>{t("bookingLog.outcome" as any)}</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => {
                    const meta = OUTCOME_META[row.outcome];
                    const Icon = meta.icon;
                    const isOpen = openRow === row.id;
                    return (
                      <Collapsible asChild key={row.id} open={isOpen} onOpenChange={(o) => setOpenRow(o ? row.id : null)}>
                        <>
                          <TableRow>
                            <TableCell className="text-xs text-muted-foreground">
                              {format(new Date(row.created_at), "MMM d, HH:mm:ss")}
                            </TableCell>
                            <TableCell>
                              <p className="text-sm font-medium">{row.guest_name || "—"}</p>
                              <p className="text-xs text-muted-foreground">{row.guest_email || "—"}</p>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize text-xs">
                                {row.reservation_type || "—"}
                              </Badge>
                              <p className="text-xs text-muted-foreground mt-0.5">{row.source}</p>
                            </TableCell>
                            <TableCell className="text-xs">
                              {row.reservation_date || "—"}
                              {row.start_time && (
                                <span className="text-muted-foreground"> · {row.start_time.slice(0, 5)}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {row.guests_requested ?? "—"} guests
                              <p className="text-muted-foreground">
                                {(row.current_load ?? 0)}/{row.capacity_total ?? "—"} on date
                              </p>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("gap-1", meta.cls)}>
                                <Icon className="h-3 w-3" />
                                {meta.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <ChevronDown
                                    className={cn(
                                      "h-4 w-4 transition-transform",
                                      isOpen && "rotate-180",
                                    )}
                                  />
                                </Button>
                              </CollapsibleTrigger>
                            </TableCell>
                          </TableRow>
                          <CollapsibleContent asChild>
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={7} className="text-xs">
                                <div className="py-2 space-y-1">
                                  <p className="font-medium text-foreground">
                                    {t("bookingLog.reasonsTitle" as any)}
                                  </p>
                                  {(row.reasons ?? []).length === 0 ? (
                                    <p className="text-muted-foreground italic">{t("bookingLog.noReasons" as any)}</p>
                                  ) : (
                                    <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                                      {(row.reasons ?? []).map((r, i) => (
                                        <li key={i}>{r}</li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BookingValidationLogPanel;
