import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, parseISO, isToday } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDateLocale } from "@/hooks/useDateLocale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useT } from "@/contexts/I18nContext";
import { useSiteContext } from "@/hooks/useSiteContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Users,
  Clock,
  UtensilsCrossed,
  Wine,
  Package,
  ChefHat,
  Bell,
  CheckCheck,
  CircleDot,
  Printer,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import DashboardTooltip from "./DashboardTooltip";
import { cn } from "@/lib/utils";
import KitchenMenuManager, { type MenuItem } from "./KitchenMenuManager";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

type Category = "food" | "drink" | "other";
type Status = "received" | "preparing" | "ready" | "served";

interface Reservation {
  id: string;
  reservation_type: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  guest_name: string;
  guests_count: number | null;
  estimated_guests: number | null;
  status: string | null;
  site_id: string | null;
  special_requests: string | null;
}

interface KitchenOrder {
  id: string;
  tenant_id: string;
  reservation_id: string;
  item_name: string;
  quantity: number;
  category: Category;
  status: Status;
  notes: string | null;
  unit_price_eur: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const CATEGORY_ICON: Record<Category, React.ElementType> = {
  food: UtensilsCrossed,
  drink: Wine,
  other: Package,
};

const STATUS_ICON: Record<Status, React.ElementType> = {
  received: CircleDot,
  preparing: ChefHat,
  ready: Bell,
  served: CheckCheck,
};

const STATUS_BADGE: Record<Status, string> = {
  received: "bg-muted text-muted-foreground",
  preparing: "bg-warning/15 text-warning-foreground border-warning/30",
  ready: "bg-accent/20 text-accent-foreground border-accent/40",
  served: "bg-primary/15 text-primary border-primary/30",
};

const KitchenOrdersPanel = () => {
  const t = useT();
  const { tenantId } = useTenant();
  const { selectedSiteId } = useSiteContext();
  const queryClient = useQueryClient();
  const dateLocale = useDateLocale();
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(today);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const selectedDateObj = parseISO(selectedDate);
  const shiftDay = (delta: number) =>
    setSelectedDate(format(addDays(selectedDateObj, delta), "yyyy-MM-dd"));

  // Reservations of restaurant/venue type for the selected date
  const { data: reservations = [], isLoading: resLoading } = useQuery({
    queryKey: ["kitchen-reservations", tenantId, selectedDate, selectedSiteId],
    enabled: !!tenantId,
    queryFn: async () => {
      let query = supabase
        .from("reservations")
        .select("id, reservation_type, date, start_time, end_time, guest_name, guests_count, estimated_guests, status, site_id, special_requests")
        .eq("tenant_id", tenantId!)
        .eq("date", selectedDate)
        .in("reservation_type", ["restaurant", "venue"])
        .neq("status", "cancelled")
        .order("start_time", { ascending: true, nullsFirst: false });
      if (selectedSiteId) query = query.eq("site_id", selectedSiteId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Reservation[];
    },
  });

  const reservationIds = reservations.map((r) => r.id);

  // Orders for those reservations
  const { data: orders = [] } = useQuery({
    queryKey: ["kitchen-orders", tenantId, reservationIds],
    enabled: !!tenantId && reservationIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kitchen_orders")
        .select("*")
        .eq("tenant_id", tenantId!)
        .in("reservation_id", reservationIds)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as KitchenOrder[];
    },
  });

  const ordersByReservation = useMemo(() => {
    const map = new Map<string, KitchenOrder[]>();
    for (const o of orders) {
      const list = map.get(o.reservation_id) ?? [];
      list.push(o);
      map.set(o.reservation_id, list);
    }
    return map;
  }, [orders]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
  };

  const addOrder = useMutation({
    mutationFn: async (reservationId: string) => {
      const { error } = await supabase.from("kitchen_orders").insert({
        tenant_id: tenantId!,
        reservation_id: reservationId,
        item_name: "",
        quantity: 1,
        category: "food",
        status: "received",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success(t("kitchen.itemAdded"));
    },
    onError: () => toast.error(t("kitchen.error")),
  });

  const updateOrder = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<KitchenOrder> }) => {
      const { error } = await supabase.from("kitchen_orders").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: () => toast.error(t("kitchen.error")),
  });

  const deleteOrder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kitchen_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success(t("kitchen.itemDeleted"));
    },
    onError: () => toast.error(t("kitchen.error")),
  });

  const guestsLabel = (r: Reservation) => r.guests_count ?? r.estimated_guests ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-foreground">{t("kitchen.title")}</h2>
          <DashboardTooltip text={t("kitchen.tooltip")} />
        </div>
        <div className="flex items-center gap-2 print:hidden flex-wrap">
          <div className="flex items-center gap-1 rounded-md border border-border bg-card">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => shiftDay(-1)}
              aria-label="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-9 px-3 gap-2 font-normal min-w-[180px] justify-start",
                    !selectedDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  {format(selectedDateObj, "PPP", { locale: dateLocale })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDateObj}
                  onSelect={(d) => {
                    if (d) {
                      setSelectedDate(format(d, "yyyy-MM-dd"));
                      setDatePickerOpen(false);
                    }
                  }}
                  initialFocus
                  locale={dateLocale}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => shiftDay(1)}
              aria-label="Next day"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant={isToday(selectedDateObj) ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedDate(today)}
          >
            {t("kitchen.today")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
            <Printer className="h-4 w-4" />
            {t("kitchen.print")}
          </Button>
        </div>
      </div>

      {resLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : reservations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
          {t("kitchen.noReservations")}
        </div>
      ) : (
        <div className="space-y-4">
          {reservations.map((r) => {
            const items = ordersByReservation.get(r.id) ?? [];
            const total = items.reduce(
              (sum, it) => sum + (it.unit_price_eur != null ? Number(it.unit_price_eur) * it.quantity : 0),
              0,
            );
            return (
              <Card key={r.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{r.guest_name}</CardTitle>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs capitalize">
                          {r.reservation_type}
                        </Badge>
                        {r.start_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {r.start_time.slice(0, 5)}
                            {r.end_time && `–${r.end_time.slice(0, 5)}`}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {guestsLabel(r)} {t("kitchen.guests")}
                        </span>
                      </div>
                      {r.special_requests && (
                        <p className="text-xs text-muted-foreground mt-1.5 italic">
                          {r.special_requests}
                        </p>
                      )}
                    </div>
                    {total > 0 && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{t("kitchen.total")}</p>
                        <p className="text-base font-semibold">{total.toFixed(2)} €</p>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">{t("kitchen.noOrders")}</p>
                  ) : (
                    <div className="space-y-2">
                      {items.map((item) => (
                        <KitchenOrderRow
                          key={item.id}
                          item={item}
                          onChange={(patch) => updateOrder.mutate({ id: item.id, patch })}
                          onDelete={() => setPendingDelete(item.id)}
                          t={t}
                        />
                      ))}
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 print:hidden"
                    onClick={() => addOrder.mutate(r.id)}
                    disabled={addOrder.isPending}
                  >
                    <Plus className="h-4 w-4" />
                    {t("kitchen.addItem")}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("kitchen.deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>{t("kitchen.delete")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) deleteOrder.mutate(pendingDelete);
                setPendingDelete(null);
              }}
            >
              {t("kitchen.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

interface RowProps {
  item: KitchenOrder;
  onChange: (patch: Partial<KitchenOrder>) => void;
  onDelete: () => void;
  t: (key: any) => string;
}

const KitchenOrderRow = ({ item, onChange, onDelete, t }: RowProps) => {
  const [local, setLocal] = useState(item);
  const CategoryIcon = CATEGORY_ICON[local.category];
  const StatusIcon = STATUS_ICON[local.status];

  const commit = (patch: Partial<KitchenOrder>) => {
    setLocal((prev) => ({ ...prev, ...patch }));
    onChange(patch);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start p-2 rounded-md border border-border bg-card/50">
      {/* Item name */}
      <div className="md:col-span-4">
        <Input
          value={local.item_name}
          placeholder={t("kitchen.itemNamePlaceholder")}
          onChange={(e) => setLocal({ ...local, item_name: e.target.value })}
          onBlur={() => {
            if (local.item_name !== item.item_name) commit({ item_name: local.item_name });
          }}
          className="h-9"
        />
      </div>

      {/* Qty */}
      <div className="md:col-span-1">
        <Input
          type="number"
          min={1}
          value={local.quantity}
          onChange={(e) => setLocal({ ...local, quantity: parseInt(e.target.value) || 1 })}
          onBlur={() => {
            if (local.quantity !== item.quantity) commit({ quantity: local.quantity });
          }}
          className="h-9"
        />
      </div>

      {/* Category */}
      <div className="md:col-span-2">
        <Select
          value={local.category}
          onValueChange={(v) => commit({ category: v as Category })}
        >
          <SelectTrigger className="h-9">
            <SelectValue>
              <span className="flex items-center gap-1.5">
                <CategoryIcon className="h-3.5 w-3.5" />
                {t(`kitchen.cat.${local.category}` as any)}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="food">{t("kitchen.cat.food")}</SelectItem>
            <SelectItem value="drink">{t("kitchen.cat.drink")}</SelectItem>
            <SelectItem value="other">{t("kitchen.cat.other")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Status */}
      <div className="md:col-span-2">
        <Select
          value={local.status}
          onValueChange={(v) => commit({ status: v as Status })}
        >
          <SelectTrigger className={cn("h-9 border", STATUS_BADGE[local.status])}>
            <SelectValue>
              <span className="flex items-center gap-1.5">
                <StatusIcon className="h-3.5 w-3.5" />
                {t(`kitchen.status.${local.status}` as any)}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="received">{t("kitchen.status.received")}</SelectItem>
            <SelectItem value="preparing">{t("kitchen.status.preparing")}</SelectItem>
            <SelectItem value="ready">{t("kitchen.status.ready")}</SelectItem>
            <SelectItem value="served">{t("kitchen.status.served")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Unit price */}
      <div className="md:col-span-2">
        <Input
          type="number"
          step="0.01"
          min={0}
          value={local.unit_price_eur ?? ""}
          placeholder="€"
          onChange={(e) =>
            setLocal({
              ...local,
              unit_price_eur: e.target.value === "" ? null : parseFloat(e.target.value),
            })
          }
          onBlur={() => {
            if (local.unit_price_eur !== item.unit_price_eur) {
              commit({ unit_price_eur: local.unit_price_eur });
            }
          }}
          className="h-9"
        />
      </div>

      {/* Delete */}
      <div className="md:col-span-1 flex md:justify-end print:hidden">
        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Notes (full width below) */}
      <div className="md:col-span-12">
        <Textarea
          value={local.notes ?? ""}
          placeholder={t("kitchen.notesPlaceholder")}
          rows={1}
          onChange={(e) => setLocal({ ...local, notes: e.target.value })}
          onBlur={() => {
            if ((local.notes ?? "") !== (item.notes ?? "")) {
              commit({ notes: local.notes });
            }
          }}
          className="min-h-9 text-xs resize-none"
        />
      </div>
    </div>
  );
};

export default KitchenOrdersPanel;
