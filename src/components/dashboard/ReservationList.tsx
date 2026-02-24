import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { format } from "date-fns";
import { CalendarDays, User, Mail, Phone, MoreVertical, CheckCircle2, XCircle, Pencil } from "lucide-react";
import EditReservationDialog from "./EditReservationDialog";
import { useT } from "@/contexts/I18nContext";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

const ReservationList = () => {
  const { tenantId } = useTenant();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [confirmDialog, setConfirmDialog] = useState<{ id: string; action: "confirmed" | "cancelled" } | null>(null);
  const [editingReservation, setEditingReservation] = useState<any | null>(null);
  const t = useT();
  const queryClient = useQueryClient();

  const { data: reservations, isLoading } = useQuery({
    queryKey: ["reservations", tenantId, statusFilter, typeFilter],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase.from("reservations").select("*").eq("tenant_id", tenantId).order("date", { ascending: false });
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (typeFilter !== "all") query = query.eq("reservation_type", typeFilter);
      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("reservations")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("tenant_id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      toast.success(t("dashboard.statusUpdated"));
      setConfirmDialog(null);
    },
    onError: () => {
      toast.error("Error updating status");
    },
  });

  const handleAction = () => {
    if (!confirmDialog) return;
    updateStatus.mutate({ id: confirmDialog.id, status: confirmDialog.action });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-serif font-bold text-foreground">{t("nav.reservations")}</h2>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder={t("common.status")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("dashboard.allStatuses")}</SelectItem>
              <SelectItem value="pending">{t("dashboard.pending")}</SelectItem>
              <SelectItem value="confirmed">{t("dashboard.confirmed")}</SelectItem>
              <SelectItem value="cancelled">{t("dashboard.cancelled")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder={t("common.type")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("dashboard.allTypes")}</SelectItem>
              <SelectItem value="restaurant">{t("dashboard.restaurant")}</SelectItem>
              <SelectItem value="venue">{t("dashboard.venue")}</SelectItem>
              <SelectItem value="guesthouse">{t("dashboard.guesthouse")}</SelectItem>
              <SelectItem value="hotel">{t("dashboard.hotel")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-4 h-20" /></Card>
          ))}
        </div>
      ) : !reservations?.length ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">{t("dashboard.noReservations")}</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {reservations.map((r) => (
            <Card key={r.id} className="hover:shadow-hover transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-foreground">{r.guest_name}</span>
                      <Badge variant="outline" className="text-xs capitalize">{r.reservation_type}</Badge>
                      <Badge className={`text-xs ${statusColors[r.status ?? "pending"] ?? ""}`}>{r.status}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {format(new Date(r.date), "PPP")}
                        {r.start_time && ` at ${r.start_time.slice(0, 5)}`}
                      </span>
                      <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{r.guest_email}</span>
                      {r.guest_phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{r.guest_phone}</span>}
                      {r.guests_count && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{r.guests_count} {t("common.guests")}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.price_eur != null && (
                      <span className="text-sm font-semibold text-foreground whitespace-nowrap">€{Number(r.price_eur).toFixed(2)}</span>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                         <DropdownMenuItem onClick={() => setEditingReservation(r)} className="gap-2">
                            <Pencil className="h-4 w-4" />
                            {t("dashboard.editReservation")}
                          </DropdownMenuItem>
                          {r.status !== "confirmed" && (
                           <DropdownMenuItem onClick={() => setConfirmDialog({ id: r.id, action: "confirmed" })} className="gap-2">
                             <CheckCircle2 className="h-4 w-4 text-primary" />
                             {t("dashboard.confirmReservation")}
                           </DropdownMenuItem>
                         )}
                         {r.status !== "cancelled" && (
                           <DropdownMenuItem onClick={() => setConfirmDialog({ id: r.id, action: "cancelled" })} className="gap-2 text-destructive focus:text-destructive">
                             <XCircle className="h-4 w-4" />
                             {t("dashboard.cancelReservation")}
                           </DropdownMenuItem>
                         )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirmation dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog?.action === "confirmed" ? t("dashboard.confirmReservation") : t("dashboard.cancelReservation")}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.action === "confirmed" ? t("dashboard.confirmReservationMsg") : t("dashboard.cancelReservationMsg")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>{t("common.cancel")}</Button>
            <Button
              variant={confirmDialog?.action === "cancelled" ? "destructive" : "default"}
              onClick={handleAction}
              disabled={updateStatus.isPending}
            >
              {confirmDialog?.action === "confirmed" ? t("dashboard.confirmReservation") : t("dashboard.cancelReservation")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <EditReservationDialog
        reservation={editingReservation}
        open={!!editingReservation}
        onOpenChange={(open) => !open && setEditingReservation(null)}
      />
    </div>
  );
};

export default ReservationList;
