import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bell, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/contexts/I18nContext";

interface WaitlistButtonProps {
  tenantId: string;
  siteId: string | null;
  date: string;
  reservationType: string;
  accentColor: string;
}

const WaitlistButton = ({ tenantId, siteId, date, reservationType, accentColor }: WaitlistButtonProps) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const joinMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("waitlist").insert({
        tenant_id: tenantId,
        site_id: siteId,
        date,
        reservation_type: reservationType,
        guest_email: email.trim(),
        guest_name: name.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSubmitted(true);
      toast.success(t("booking.waitlistJoined" as any) || "You've been added to the waitlist!");
    },
    onError: (err: any) => {
      if (err.message?.includes("duplicate")) {
        toast.error(t("booking.waitlistAlready" as any) || "You're already on the waitlist for this date.");
      } else {
        toast.error(err.message || "Failed to join waitlist");
      }
    },
  });

  if (submitted) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle className="h-4 w-4" style={{ color: accentColor }} />
        {t("booking.waitlistConfirmed" as any) || "You're on the waitlist!"}
      </div>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
        style={{ borderColor: accentColor, color: accentColor }}
      >
        <Bell className="h-3.5 w-3.5" />
        {t("booking.joinWaitlist" as any) || "Join Waitlist"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {t("booking.joinWaitlist" as any) || "Join Waitlist"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("booking.waitlistDesc" as any) || "We'll notify you by email if a spot opens up for this date."}
          </p>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="wl-name">{t("common.name" as any)}</Label>
              <Input id="wl-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wl-email">{t("common.email" as any)}</Label>
              <Input id="wl-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <Button
              onClick={() => joinMutation.mutate()}
              disabled={joinMutation.isPending || !email.trim() || !name.trim()}
              className="w-full text-white"
              style={{ backgroundColor: accentColor }}
            >
              {joinMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (t("booking.joinWaitlist" as any) || "Join Waitlist")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WaitlistButton;
