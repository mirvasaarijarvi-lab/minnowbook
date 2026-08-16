import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CalendarDays, Clock, Users, MapPin, Mail, Phone, CheckCircle, XCircle, Loader2, UtensilsCrossed, Home, Building2 } from "lucide-react";
import { format } from "date-fns";
import Logo from "@/components/Logo";
import SEOHead from "@/components/SEOHead";
import { toast } from "sonner";
import { useT } from "@/contexts/I18nContext";

const typeIcons: Record<string, React.ElementType> = {
  restaurant: UtensilsCrossed,
  venue: Building2,
  guesthouse: Home,
  hotel: Home,
};

const GuestPortal = () => {
  const { token } = useParams<{ token: string }>();
  const t = useT();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [note, setNote] = useState("");
  const [rescheduleSent, setRescheduleSent] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["guest-booking", token],
    queryFn: async () => {
      if (!token) throw new Error("No token");

      // Look up token
      const { data: tokenData, error: tokenErr } = await supabase
        .from("booking_tokens")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (tokenErr) throw tokenErr;
      if (!tokenData) throw new Error("not_found");
      if (tokenData.is_revoked) throw new Error("revoked");
      if (new Date(tokenData.expires_at) < new Date()) throw new Error("expired");

      // Fetch reservation
      const { data: reservation, error: resErr } = await supabase
        .from("reservations")
        .select("*")
        .eq("id", tokenData.reservation_id)
        .maybeSingle();

      if (resErr) throw resErr;
      if (!reservation) throw new Error("not_found");

      // Fetch tenant settings for branding
      const { data: tenantSettings } = await supabase
        .from("tenant_settings_public" as any)
        .select("business_name, primary_color, logo_url")
        .eq("tenant_id", tokenData.tenant_id)
        .maybeSingle();

      return { reservation, token: tokenData, settings: tenantSettings };
    },
    enabled: !!token,
  });

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      const { data: res, error } = await supabase.functions.invoke("guest-booking-portal", {
        body: {
          action: "reschedule",
          token,
          requested_date: newDate,
          requested_start_time: newTime || null,
          guest_note: note || null,
        },
      });
      if (error) throw error;
      if ((res as any)?.error) throw new Error((res as any).error);
      return res;
    },
    onSuccess: () => {
      setRescheduleSent(true);
      toast.success(t("guest.portal.requestSentToast"));
    },
    onError: (err: Error) => {
      toast.error(err.message || t("guest.portal.requestError"));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      // Guests are unauthenticated, so the cancellation runs server-side
      // through the booking token instead of a direct table write.
      const { data: res, error } = await supabase.functions.invoke("guest-booking-portal", {
        body: { action: "cancel", token },
      });
      if (error) throw error;
      if ((res as any)?.error) throw new Error((res as any).error);
      return res;
    },
    onSuccess: () => {
      toast.success(t("guest.portal.cancelSuccess"));
      setCancelOpen(false);
      refetch();
    },
    onError: () => {
      toast.error(t("guest.portal.cancelError"));
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    const msg = (error as Error).message;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-serif font-semibold">
              {msg === "expired" ? t("guest.portal.linkExpiredTitle") : msg === "revoked" ? t("guest.portal.linkRevokedTitle") : t("guest.portal.notFoundTitle")}
            </h2>
            <p className="text-muted-foreground">
              {msg === "expired"
                ? t("guest.portal.linkExpiredBody")
                : msg === "revoked"
                ? t("guest.portal.linkRevokedBody")
                : t("guest.portal.notFoundBody")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const res = data!.reservation;
  const isCancelled = res.status === "cancelled";
  const isPast = new Date(res.date) < new Date(new Date().toDateString());
  const TypeIcon = typeIcons[res.reservation_type] ?? CalendarDays;

  const statusColor = {
    confirmed: "border-emerald-500/30 text-emerald-600 bg-emerald-500/10",
    pending: "border-amber-500/30 text-amber-600 bg-amber-500/10",
    cancelled: "border-destructive/30 text-destructive bg-destructive/10",
  }[res.status ?? "pending"] ?? "border-border text-muted-foreground";

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Your reservation | MimmoBook Guest Portal"
        description="View, manage, or cancel your reservation directly from the MimmoBook guest portal using your secure booking link."
        path={`/my-booking/${token ?? ""}`}
        type="website"
      />
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Logo variant="color" size="sm" />
          <span className="text-sm text-muted-foreground">{t("guest.portal.label")}</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TypeIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="font-serif text-lg">{t("guest.portal.title")}</CardTitle>
                  <p className="text-sm text-muted-foreground capitalize">{res.reservation_type}</p>
                </div>
              </div>
              <Badge variant="outline" className={statusColor}>
                {res.status === "confirmed" && <CheckCircle className="h-3 w-3 mr-1" />}
                {(res.status ?? "pending").charAt(0).toUpperCase() + (res.status ?? "pending").slice(1)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{format(new Date(res.date), "EEEE, MMMM d, yyyy")}</span>
              </div>
              {res.start_time && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{res.start_time}{res.end_time ? ` — ${res.end_time}` : ""}</span>
                </div>
              )}
              {(res.guests_count || res.estimated_guests) && (
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{res.guests_count || res.estimated_guests} {t("guest.portal.guestsSuffix")}</span>
                </div>
              )}
              {res.check_out_date && (
                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{t("guest.portal.checkOut")}: {format(new Date(res.check_out_date), "MMM d, yyyy")}</span>
                </div>
              )}
            </div>

            {res.special_requests && (
              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground mb-1">{t("guest.portal.specialRequests")}</p>
                <p className="text-sm">{res.special_requests}</p>
              </div>
            )}

            {res.price_eur != null && (
              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground mb-1">{t("guest.portal.total")}</p>
                <p className="text-lg font-semibold">€{Number(res.price_eur).toFixed(2)}</p>
              </div>
            )}

            {!isCancelled && !isPast && (
              <div className="border-t border-border pt-4 space-y-4">
                {rescheduleSent ? (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                    {t("guest.portal.requestSentBanner")}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">{t("guest.portal.needDifferentDate")}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="reschedule-date" className="text-xs text-muted-foreground">{t("guest.portal.newDate")}</Label>
                        <Input
                          id="reschedule-date"
                          type="date"
                          value={newDate}
                          min={format(new Date(), "yyyy-MM-dd")}
                          onChange={(e) => setNewDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="reschedule-time" className="text-xs text-muted-foreground">{t("guest.portal.newTime")}</Label>
                        <Input
                          id="reschedule-time"
                          type="time"
                          value={newTime}
                          onChange={(e) => setNewTime(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="reschedule-note" className="text-xs text-muted-foreground">{t("guest.portal.message")}</Label>
                      <Textarea
                        id="reschedule-note"
                        value={note}
                        maxLength={1000}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={t("guest.portal.messagePlaceholder")}
                      />
                    </div>
                    <Button
                      variant="secondary"
                      disabled={!newDate || rescheduleMutation.isPending}
                      onClick={() => rescheduleMutation.mutate()}
                    >
                      {rescheduleMutation.isPending ? t("guest.portal.sending") : t("guest.portal.requestNewDate")}
                    </Button>
                  </div>
                )}

                <Button
                  variant="outline"
                  className="border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={() => setCancelOpen(true)}
                >
                  {t("guest.portal.cancelBooking")}
                </Button>
              </div>
            )}

            {isPast && !isCancelled && (
              <div className="border-t border-border pt-3 text-sm text-muted-foreground">
                {t("guest.portal.pastBooking")}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            {t("guest.portal.questionsFooter")}
          </p>
        </div>
      </main>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("guest.portal.cancelTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("guest.portal.cancelDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("guest.portal.keepBooking")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelMutation.isPending ? t("guest.portal.cancelling") : t("guest.portal.yesCancel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GuestPortal;
