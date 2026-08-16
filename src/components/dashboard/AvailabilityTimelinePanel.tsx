import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useSiteContext } from "@/hooks/useSiteContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CalendarRange, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { format, addDays } from "date-fns";
import { useT } from "@/contexts/I18nContext";
import { useAutoApproval } from "@/hooks/useAutoApproval";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Bar = {
  id: string;
  label: string;
  startMin: number;
  endMin: number;
  kind: "reservation" | "block" | "slot";
  status?: string | null;
};

const toMinutes = (time: string | null | undefined, fallback: number) => {
  if (!time) return fallback;
  const [h, m] = time.split(":");
  const mins = Number(h) * 60 + Number(m ?? 0);
  return Number.isFinite(mins) ? mins : fallback;
};

type TimelineRow = {
  key: string;
  title: string;
  subtitle?: string;
  bars: Bar[];
  resourceType: string;
  resourceId: string | null;
  siteId: string | null;
};

/** Drags snap to quarter hours so a block never lands on an odd minute. */
const SNAP_MINUTES = 15;
const snap = (mins: number) => Math.round(mins / SNAP_MINUTES) * SNAP_MINUTES;

const fmt = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

const AvailabilityTimelinePanel = () => {
  const { tenantId } = useTenant();
  const { selectedSiteId } = useSiteContext();
  const t = useT();
  const [day, setDay] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const { data, isLoading } = useQuery({
    queryKey: ["availability-timeline", tenantId, selectedSiteId, day],
    enabled: !!tenantId,
    queryFn: async () => {
      let resourcesQuery = supabase
        .from("resources")
        .select("id, name, resource_type, capacity, site_id, is_active")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("resource_type")
        .order("name");
      if (selectedSiteId) resourcesQuery = resourcesQuery.eq("site_id", selectedSiteId);

      let reservationsQuery = supabase
        .from("reservations")
        .select("id, guest_name, reservation_type, status, date, start_time, end_time, guests_count, site_id")
        .eq("tenant_id", tenantId!)
        .eq("date", day)
        .neq("status", "cancelled");
      if (selectedSiteId) reservationsQuery = reservationsQuery.eq("site_id", selectedSiteId);

      let blocksQuery = supabase
        .from("blocked_slots")
        .select("id, resource_type, resource_id, date, start_time, end_time, reason, site_id")
        .eq("tenant_id", tenantId!)
        .eq("date", day);
      if (selectedSiteId) blocksQuery = blocksQuery.eq("site_id", selectedSiteId);

      const slotsQuery = supabase
        .from("resource_availability_slots")
        .select("id, resource_id, slot_date, start_time, end_time, note")
        .eq("tenant_id", tenantId!)
        .eq("slot_date", day);

      const [resources, reservations, blocks, slots] = await Promise.all([
        resourcesQuery,
        reservationsQuery,
        blocksQuery,
        slotsQuery,
      ]);
      if (resources.error) throw resources.error;

      return {
        resources: resources.data ?? [],
        reservations: reservations.data ?? [],
        blocks: blocks.data ?? [],
        slots: slots.data ?? [],
      };
    },
  });

  const rows = useMemo(() => {
    if (!data) return [] as TimelineRow[];
    const byType = new Map<string, typeof data.resources>();
    for (const r of data.resources) {
      const list = byType.get(r.resource_type) ?? [];
      list.push(r);
      byType.set(r.resource_type, list);
    }

    const out: TimelineRow[] = [];

    for (const [type, resourceList] of byType) {
      const typeBars: Bar[] = [
        ...data.reservations
          .filter((r) => r.reservation_type === type)
          .map((r) => ({
            id: `res-${r.id}`,
            label: `${r.guest_name}${r.guests_count ? ` (${r.guests_count})` : ""}`,
            startMin: toMinutes(r.start_time, 9 * 60),
            endMin: toMinutes(r.end_time, toMinutes(r.start_time, 9 * 60) + 90),
            kind: "reservation" as const,
            status: r.status,
          })),
        ...data.blocks
          .filter((b) => b.resource_type === type && !b.resource_id)
          .map((b) => ({
            id: `blk-${b.id}`,
            label: b.reason || t("timeline.blocked"),
            startMin: toMinutes(b.start_time, 0),
            endMin: toMinutes(b.end_time, 24 * 60),
            kind: "block" as const,
          })),
      ];
      out.push({
        key: `type-${type}`,
        title: type,
        subtitle: `${resourceList.length}`,
        bars: typeBars,
        resourceType: type,
        resourceId: null,
        siteId: (resourceList[0] as any)?.site_id ?? null,
      });

      for (const resource of resourceList) {
        const bars: Bar[] = [
          ...data.blocks
            .filter((b) => b.resource_id === resource.id)
            .map((b) => ({
              id: `blk-${b.id}`,
              label: b.reason || t("timeline.blocked"),
              startMin: toMinutes(b.start_time, 0),
              endMin: toMinutes(b.end_time, 24 * 60),
              kind: "block" as const,
            })),
          ...data.slots
            .filter((s) => s.resource_id === resource.id)
            .map((s) => ({
              id: `slot-${s.id}`,
              label: s.note || t("timeline.availableSlot"),
              startMin: toMinutes(s.start_time, 0),
              endMin: toMinutes(s.end_time, 24 * 60),
              kind: "slot" as const,
            })),
        ];
        out.push({
          key: `res-${resource.id}`,
          title: resource.name,
          subtitle: resource.capacity ? `${resource.capacity}` : undefined,
          bars,
          resourceType: resource.resource_type,
          resourceId: resource.id,
          siteId: (resource as any).site_id ?? null,
        });
      }
    }
    return out;
  }, [data, t]);

  const [windowStart, windowEnd] = useMemo(() => {
    const all = rows.flatMap((r) => r.bars);
    if (all.length === 0) return [8 * 60, 22 * 60];
    const min = Math.min(...all.map((b) => b.startMin), 8 * 60);
    const max = Math.max(...all.map((b) => b.endMin), 22 * 60);
    return [Math.floor(min / 60) * 60, Math.min(24 * 60, Math.ceil(max / 60) * 60)];
  }, [rows]);

  const span = Math.max(60, windowEnd - windowStart);
  const hourMarks = useMemo(() => {
    const marks: number[] = [];
    for (let m = windowStart; m <= windowEnd; m += 60) marks.push(m);
    return marks;
  }, [windowStart, windowEnd]);

  const queryClient = useQueryClient();
  const { getApprovalStatus } = useAutoApproval();
  const laneRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [drag, setDrag] = useState<{ rowKey: string; startMin: number; endMin: number } | null>(null);
  const [pendingBlock, setPendingBlock] = useState<
    { row: TimelineRow; startMin: number; endMin: number } | null
  >(null);
  const [blockReason, setBlockReason] = useState("");

  /** Convert a pointer position inside a lane into snapped minutes. */
  const minutesFromPointer = (rowKey: string, clientX: number) => {
    const lane = laneRefs.current[rowKey];
    if (!lane) return null;
    const rect = lane.getBoundingClientRect();
    if (rect.width === 0) return null;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return snap(windowStart + ratio * span);
  };

  /**
   * A block must never be dropped on top of a live booking, otherwise staff
   * would silently double-book themselves out of a reserved slot.
   */
  const overlapsReservation = (row: TimelineRow, from: number, to: number) =>
    row.bars.some(
      (bar) => bar.kind === "reservation" && bar.startMin < to && bar.endMin > from,
    );

  const dragInvalid = useMemo(() => {
    if (!drag) return false;
    const row = rows.find((r) => r.key === drag.rowKey);
    if (!row) return false;
    const from = Math.min(drag.startMin, drag.endMin);
    const to = Math.max(drag.startMin, drag.endMin);
    return to - from >= SNAP_MINUTES && overlapsReservation(row, from, to);
  }, [drag, rows]);

  const removeBlock = async (blockId: string) => {
    const { error } = await supabase.from("blocked_slots").delete().eq("id", blockId);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["availability-timeline"] });
    queryClient.invalidateQueries({ queryKey: ["blocked-slots"] });
    queryClient.invalidateQueries({ queryKey: ["approval-queue-count"] });
    toast.success(t("timeline.blockUndone"));
  };

  const createBlock = useMutation({
    mutationFn: async () => {
      if (!pendingBlock || !tenantId) throw new Error("Missing block");
      const { row, startMin, endMin } = pendingBlock;
      const { data, error } = await supabase
        .from("blocked_slots")
        .insert({
          tenant_id: tenantId,
          site_id: row.siteId ?? selectedSiteId ?? null,
          date: day,
          resource_type: row.resourceType,
          resource_id: row.resourceId,
          start_time: `${fmt(startMin)}:00`,
          end_time: `${fmt(endMin)}:00`,
          reason: blockReason.trim() || null,
          approval_status: getApprovalStatus(),
        })
        .select("id")
        .single();
      if (error) throw error;
      return data?.id as string | undefined;
    },
    onSuccess: (blockId) => {
      queryClient.invalidateQueries({ queryKey: ["availability-timeline"] });
      queryClient.invalidateQueries({ queryKey: ["blocked-slots"] });
      queryClient.invalidateQueries({ queryKey: ["approval-queue-count"] });
      setPendingBlock(null);
      setBlockReason("");
      toast.success(t("timeline.blockCreated"), {
        action: blockId
          ? { label: t("timeline.undo"), onClick: () => void removeBlock(blockId) }
          : undefined,
      });
    },
    onError: (err: any) => {
      toast.error(err?.message || t("timeline.blockError"));
    },
  });

  const barClass = (kind: Bar["kind"], status?: string | null) => {
    if (kind === "block") return "bg-destructive/20 border-destructive/40 text-destructive";
    if (kind === "slot") return "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400";
    if (status === "pending") return "bg-amber-500/20 border-amber-500/40 text-amber-700 dark:text-amber-400";
    return "bg-primary/20 border-primary/40 text-primary";
  };

  return (
    <Card data-tour="availability-timeline">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="font-serif text-lg flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-primary" />
          {t("timeline.title")}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label={t("timeline.previousDay")} onClick={() => setDay(format(addDays(new Date(day), -1), "yyyy-MM-dd"))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="w-[10.5rem]" />
          <Button variant="outline" size="icon" aria-label={t("timeline.nextDay")} onClick={() => setDay(format(addDays(new Date(day), 1), "yyyy-MM-dd"))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-primary/30 border border-primary/40" />{t("timeline.legendReservation")}</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-amber-500/30 border border-amber-500/40" />{t("timeline.legendPending")}</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-destructive/30 border border-destructive/40" />{t("timeline.legendBlocked")}</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-emerald-500/30 border border-emerald-500/40" />{t("timeline.legendSlot")}</span>
        </div>

        <p className="text-xs text-muted-foreground">{t("timeline.dragHint")}</p>

        {isLoading ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("timeline.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[46rem]">
              <div className="flex border-b border-border pb-1 mb-1">
                <div className="w-44 shrink-0 text-xs text-muted-foreground">{t("timeline.resource")}</div>
                <div className="relative flex-1 h-4">
                  {hourMarks.map((m) => (
                    <span
                      key={m}
                      className="absolute -translate-x-1/2 text-[10px] text-muted-foreground"
                      style={{ left: `${((m - windowStart) / span) * 100}%` }}
                    >
                      {fmt(m)}
                    </span>
                  ))}
                </div>
              </div>

              {rows.map((row) => {
                const isTypeRow = row.key.startsWith("type-");
                return (
                  <div key={row.key} className="flex items-center gap-2 py-1">
                    <div className={`w-44 shrink-0 truncate text-sm ${isTypeRow ? "font-semibold capitalize" : "pl-4 text-muted-foreground"}`}>
                      {row.title}
                      {row.subtitle && (
                        <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0">{row.subtitle}</Badge>
                      )}
                    </div>
                    <div
                      ref={(el) => { laneRefs.current[row.key] = el; }}
                      role="presentation"
                      className="relative flex-1 h-8 rounded-md bg-muted/40 border border-border/60 cursor-crosshair touch-none"
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        const start = minutesFromPointer(row.key, e.clientX);
                        if (start === null) return;
                        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                        setDrag({ rowKey: row.key, startMin: start, endMin: start });
                      }}
                      onPointerMove={(e) => {
                        if (!drag || drag.rowKey !== row.key) return;
                        const now = minutesFromPointer(row.key, e.clientX);
                        if (now === null) return;
                        setDrag({ ...drag, endMin: now });
                      }}
                      onPointerUp={() => {
                        if (!drag || drag.rowKey !== row.key) return;
                        const from = Math.min(drag.startMin, drag.endMin);
                        const to = Math.max(drag.startMin, drag.endMin);
                        setDrag(null);
                        // A click (zero-length drag) should not silently block a whole day.
                        if (to - from < SNAP_MINUTES) return;
                        setBlockReason("");
                        setPendingBlock({ row, startMin: from, endMin: to });
                      }}
                      onPointerCancel={() => setDrag(null)}
                    >
                      {hourMarks.map((m) => (
                        <span key={m} className="absolute top-0 bottom-0 w-px bg-border/60" style={{ left: `${((m - windowStart) / span) * 100}%` }} />
                      ))}
                      {drag && drag.rowKey === row.key && Math.abs(drag.endMin - drag.startMin) >= SNAP_MINUTES && (
                        <div
                          className="absolute top-1 bottom-1 rounded border border-destructive/60 bg-destructive/25 pointer-events-none"
                          style={{
                            left: `${((Math.min(drag.startMin, drag.endMin) - windowStart) / span) * 100}%`,
                            width: `${(Math.abs(drag.endMin - drag.startMin) / span) * 100}%`,
                          }}
                        />
                      )}
                      {row.bars.map((bar) => {
                        const left = ((Math.max(bar.startMin, windowStart) - windowStart) / span) * 100;
                        const width = ((Math.min(bar.endMin, windowEnd) - Math.max(bar.startMin, windowStart)) / span) * 100;
                        if (width <= 0) return null;
                        return (
                          <div
                            key={bar.id}
                            title={`${bar.label} ${fmt(bar.startMin)} to ${fmt(bar.endMin)}`}
                            className={`absolute top-1 bottom-1 rounded border px-1 text-[11px] leading-6 truncate ${barClass(bar.kind, bar.status)}`}
                            style={{ left: `${left}%`, width: `${Math.max(width, 1.5)}%` }}
                          >
                            {bar.label}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={!!pendingBlock} onOpenChange={(open) => { if (!open) setPendingBlock(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">{t("timeline.newBlockTitle")}</DialogTitle>
            <DialogDescription>{t("timeline.newBlockDescription")}</DialogDescription>
          </DialogHeader>
          {pendingBlock && (
            <div className="space-y-3">
              <p className="text-sm">
                <span className="font-medium">{pendingBlock.row.title}</span>
                {" · "}
                {day} {fmt(pendingBlock.startMin)} to {fmt(pendingBlock.endMin)}
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="timeline-block-reason">{t("timeline.reason")}</Label>
                <Input
                  id="timeline-block-reason"
                  value={blockReason}
                  maxLength={200}
                  placeholder={t("timeline.reasonPlaceholder")}
                  onChange={(e) => setBlockReason(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingBlock(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => createBlock.mutate()} disabled={createBlock.isPending}>
              {createBlock.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("timeline.createBlock")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AvailabilityTimelinePanel;
