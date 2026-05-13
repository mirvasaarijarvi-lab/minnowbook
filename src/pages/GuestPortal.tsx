import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CalendarDays, Clock, Users, MapPin, Mail, Phone, CheckCircle, XCircle, Loader2, UtensilsCrossed, Home, Building2 } from "lucide-react";
import { format } from "date-fns";
import Logo from "@/components/Logo";
import { toast } from "sonner";

const typeIcons: Record<string, React.ElementType> = {
  restaurant: UtensilsCrossed,
  venue: Building2,
  guesthouse: Home,
  hotel: Home,
};

const GuestPortal = () => {
  const { token } = useParams<{ token: string }>();
  const [cancelOpen, setCancelOpen] = useState(false);

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

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!data?.reservation) return;
      const { error } = await supabase
        .from("reservations")
        .update({ status: "cancelled" })
        .eq("id", data.reservation.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Your booking has been cancelled.");
      setCancelOpen(false);
      refetch();
    },
    onError: () => {
      toast.error("Failed to cancel. Please try again.");
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
              {msg === "expired" ? "Link Expired" : msg === "revoked" ? "Link Revoked" : "Booking Not Found"}
            </h2>
            <p className="text-muted-foreground">
              {msg === "expired"
                ? "This booking link has expired. Please contact the venue for assistance."
                : msg === "revoked"
                ? "This link has been revoked. Please contact the venue."
                : "We couldn't find a booking with this link. It may have been removed."}
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
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Logo variant="color" size="sm" />
          <span className="text-sm text-muted-foreground">Guest Portal</span>
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
                  <CardTitle className="font-serif text-lg">Your Booking</CardTitle>
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
                  <span>{res.guests_count || res.estimated_guests} guest(s)</span>
                </div>
              )}
              {res.check_out_date && (
                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>Check-out: {format(new Date(res.check_out_date), "MMM d, yyyy")}</span>
                </div>
              )}
            </div>

            {res.special_requests && (
              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground mb-1">Special Requests</p>
                <p className="text-sm">{res.special_requests}</p>
              </div>
            )}

            {res.price_eur != null && (
              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground mb-1">Total</p>
                <p className="text-lg font-semibold">€{Number(res.price_eur).toFixed(2)}</p>
              </div>
            )}

            {!isCancelled && !isPast && (
              <div className="border-t border-border pt-4">
                <Button
                  variant="outline"
                  className="border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={() => setCancelOpen(true)}
                >
                  Cancel Booking
                </Button>
              </div>
            )}

            {isPast && !isCancelled && (
              <div className="border-t border-border pt-3 text-sm text-muted-foreground">
                This booking date has passed. We hope you enjoyed your visit!
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Questions? Contact the venue directly using the details in your confirmation email.
          </p>
        </div>
      </main>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel your booking?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel your booking for {format(new Date(res?.date ?? new Date()), "MMMM d, yyyy")}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Booking</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelMutation.isPending ? "Cancelling..." : "Yes, Cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GuestPortal;
