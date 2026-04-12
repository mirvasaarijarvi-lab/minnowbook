import { useState, forwardRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useT } from "@/contexts/I18nContext";
import { useUpdateOffer, type Offer } from "@/hooks/useOffers";
import { useTenant } from "@/hooks/useTenant";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import type { TenantBranding } from "@/lib/offerPdf";

interface Props {
  offer: Offer;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const OfferEmailDialog = forwardRef<HTMLDivElement, Props>(({ offer, open, onOpenChange }, ref) => {
  const t = useT();
  const updateOffer = useUpdateOffer();
  const { tenant } = useTenant();
  const businessName = (tenant as any)?.name || "MimmoBook";

  const defaultSubject = `Offer – ${businessName}`;
  const defaultBody = `Dear ${offer.guest_name},\n\nPlease find attached the offer for your event. We kindly ask you to review the details and confirm if the offer is accepted.\n\nBest regards,\n${businessName}`;

  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);

  const [lastOfferId, setLastOfferId] = useState(offer.id);
  if (offer.id !== lastOfferId) {
    setLastOfferId(offer.id);
    setSubject(defaultSubject);
    setBody(defaultBody);
  }

  const handleSend = async () => {
    setSending(true);
    try {
      // Generate PDF client-side
      const { generateOfferPdf } = await import("@/lib/offerPdf");
      const pdfBlob = await generateOfferPdf(offer, offer.language || "en", businessName);
      const pdfBase64 = await blobToBase64(pdfBlob);

      const { data, error } = await supabase.functions.invoke("send-offer-email", {
        body: {
          to: offer.guest_email,
          subject,
          htmlBody: body.replace(/\n/g, "<br/>"),
          textBody: body,
          pdfBase64,
          pdfFilename: `Offer_${offer.guest_name.replace(/\s+/g, "_")}_${offer.event_date}.pdf`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.emailSent === false) {
        toast.info(data.reason || "Email not configured yet");
      }

      await updateOffer.mutateAsync({
        id: offer.id,
        status: "sent",
        last_sent_at: new Date().toISOString(),
        last_send_provider_id: data?.providerId || null,
      } as any);
      toast.success(t("offers.emailSent"));
      onOpenChange(false);
    } catch (err: any) {
      console.error("Send offer email error:", err);
      toast.error(t("offers.emailError"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={ref} className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("offers.sendEmail")}</DialogTitle>
          <DialogDescription className="sr-only">Send offer via email</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("offers.emailTo")}</Label>
            <Input value={offer.guest_email} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>{t("offers.emailSubject")}</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("offers.emailBody")}</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} />
          </div>
          <p className="text-xs text-muted-foreground">{t("offers.pdfAttached")}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> {t("common.saving")}</> : t("offers.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

OfferEmailDialog.displayName = "OfferEmailDialog";

export default OfferEmailDialog;
