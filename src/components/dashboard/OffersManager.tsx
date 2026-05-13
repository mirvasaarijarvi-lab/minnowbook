import { useState, useMemo, useCallback } from "react";
import { useT } from "@/contexts/I18nContext";
import { useOffers, useUpdateOffer, type Offer } from "@/hooks/useOffers";
import { useTenant } from "@/hooks/useTenant";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { format, parseISO } from "date-fns";
import { Plus, FileText, Check, Send, Printer, Archive, ArchiveRestore, Search, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import OfferCreateDialog from "./OfferCreateDialog";
import OfferEmailDialog from "./OfferEmailDialog";
import { useDateLocale } from "@/hooks/useDateLocale";
import DashboardTooltip from "./DashboardTooltip";

const OffersManager = () => {
  const t = useT();
  const dateLocale = useDateLocale();
  const { tenantId } = useTenant();
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: offers = [], isLoading } = useOffers(showArchived);
  const updateOffer = useUpdateOffer();
  const [createOpen, setCreateOpen] = useState(false);
  const [emailOffer, setEmailOffer] = useState<Offer | null>(null);
  const [editOffer, setEditOffer] = useState<Offer | null>(null);

  const filteredOffers = useMemo(() => {
    if (!searchQuery.trim()) return offers;
    const q = searchQuery.toLowerCase().trim();
    return offers.filter((offer) => {
      const nameMatch = offer.guest_name.toLowerCase().includes(q);
      const dateMatch = offer.event_date.includes(q) || format(parseISO(offer.event_date), "d.M.yyyy").includes(q);
      const spaceMatch = offer.event_space.toLowerCase().includes(q);
      return nameMatch || dateMatch || spaceMatch;
    });
  }, [offers, searchQuery]);

  const statusColor = (s: string) => {
    switch (s) {
      case "draft": return "secondary" as const;
      case "sent": return "default" as const;
      case "confirmed": return "default" as const;
      case "expired": return "destructive" as const;
      default: return "secondary" as const;
    }
  };

  const handleArchive = async (offer: Offer) => {
    try {
      await updateOffer.mutateAsync({ id: offer.id, archived_at: new Date().toISOString() } as any);
      toast.success(t("offers.archivedSuccess"));
    } catch {
      toast.error(t("offers.archiveError"));
    }
  };

  const handleUnarchive = async (offer: Offer) => {
    try {
      await updateOffer.mutateAsync({ id: offer.id, archived_at: null } as any);
      toast.success(t("offers.unarchivedSuccess"));
    } catch {
      toast.error(t("offers.archiveError"));
    }
  };

  const handleConfirm = async (offer: Offer) => {
    try {
      // Stamp every reservation created from this offer with a shared
      // linked_group_id so the edit dialog can show them as one bundle even
      // if the offer row is later archived.
      const linkedGroupId = crypto.randomUUID();

      // Create main reservation
      const { data: mainRes, error: mainErr } = await supabase
        .from("reservations")
        .insert({
          tenant_id: offer.tenant_id,
          reservation_type: "venue",
          status: "confirmed",
          date: offer.event_date,
          start_time: offer.start_time ? `${offer.start_time}:00` : null,
          end_time: offer.end_time ? `${offer.end_time}:00` : null,
          guest_name: offer.guest_name,
          guest_email: offer.guest_email,
          guest_phone: offer.guest_phone,
          guests_count: offer.guests_count,
          event_type: offer.event_type || null,
          room_type: offer.event_space,
          special_requests: offer.special_requests || null,
          staff_notes: "Offer → Reservation",
          language: offer.language || "en",
          linked_group_id: linkedGroupId,
        } as any)
        .select()
        .single();

      if (mainErr) throw mainErr;
      const resIds = [mainRes.id];

      // Create linked reservations
      const linked = offer.linked_reservations || {};
      for (const [key, lr] of Object.entries(linked)) {
        if (!lr.enabled) continue;
        const resType = lr.resource_type || key;

        const { data: linkedRes, error: linkedErr } = await supabase
          .from("reservations")
          .insert({
            tenant_id: offer.tenant_id,
            reservation_type: resType,
            status: "confirmed",
            date: offer.event_date,
            start_time: lr.start_time ? `${lr.start_time}:00` : (offer.start_time ? `${offer.start_time}:00` : null),
            end_time: lr.end_time ? `${lr.end_time}:00` : null,
            guest_name: offer.guest_name,
            guest_email: offer.guest_email,
            guest_phone: offer.guest_phone,
            guests_count: lr.guests_count || offer.guests_count,
            event_type: offer.event_type || null,
            room_type: lr.space || null,
            special_requests: lr.special_requests ? `Cross-reservation – via offer\n${lr.special_requests}` : "Cross-reservation – via offer",
            staff_notes: "Cross-reservation – offer",
            language: offer.language || "en",
            linked_group_id: linkedGroupId,
          } as any)
          .select()
          .single();

        if (linkedErr) throw linkedErr;
        resIds.push(linkedRes.id);
      }

      await updateOffer.mutateAsync({
        id: offer.id,
        status: "confirmed",
        reservation_ids: resIds,
      });

      toast.success(t("offers.confirmedSuccess"));
    } catch {
      toast.error(t("offers.confirmError"));
    }
  };

  const handlePrintPdf = async (offer: Offer) => {
    try {
      const { generateOfferPdf } = await import("@/lib/offerPdf");
      const pdfBlob = await generateOfferPdf(offer, offer.language || "en");
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Offer_${offer.guest_name.replace(/\s+/g, "_")}_${offer.event_date}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("PDF error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xl sm:text-2xl font-serif font-bold text-foreground">{t("offers.title")}</h3>
          <DashboardTooltip text={t("offers.tooltip")} />
        </div>
        <Button onClick={() => { setEditOffer(null); setCreateOpen(true); }} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          {t("offers.create")}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("offers.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} id="show-archived" />
          <Label htmlFor="show-archived" className="text-sm cursor-pointer">{t("offers.showArchived")}</Label>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
      ) : filteredOffers.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">
          {searchQuery.trim() ? t("offers.noResults") : t("offers.empty")}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filteredOffers.map((offer) => {
            const isArchived = !!offer.archived_at;
            return (
              <Card key={offer.id} className={`hover:shadow-sm transition-shadow ${isArchived ? "opacity-60" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{offer.guest_name}</span>
                        <Badge variant={statusColor(offer.status)} className="text-[10px]">
                          {t(`offers.status${offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}` as any)}
                        </Badge>
                        {isArchived && (
                          <Badge variant="outline" className="text-[10px]">{t("offers.archived")}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(offer.event_date), "PPP", { locale: dateLocale })} • {offer.start_time}{offer.end_time ? ` – ${offer.end_time}` : ""} • {offer.guests_count} {t("common.guests").toLowerCase()} • {offer.event_space}
                      </p>
                      {offer.last_sent_at && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {t("offers.lastSent")}: {format(parseISO(offer.last_sent_at), "d.M.yyyy HH:mm", { locale: dateLocale })}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => handlePrintPdf(offer)} title="PDF">
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditOffer(offer); setCreateOpen(true); }}>
                        <FileText className="h-3.5 w-3.5 mr-1" />
                        {t("common.edit")}
                      </Button>
                      {(offer.status === "draft" || offer.status === "sent") && !isArchived && (
                        <Button size="sm" variant="outline" onClick={() => setEmailOffer(offer)}>
                          <Send className="h-3.5 w-3.5 mr-1" />
                          {t("offers.send")}
                        </Button>
                      )}
                      {(offer.status === "sent" || offer.status === "draft") && !isArchived && (
                        <Button size="sm" onClick={() => handleConfirm(offer)}>
                          <Check className="h-3.5 w-3.5 mr-1" />
                          {t("offers.confirm")}
                        </Button>
                      )}
                      {isArchived ? (
                        <Button size="sm" variant="outline" onClick={() => handleUnarchive(offer)} title={t("offers.unarchive")}>
                          <ArchiveRestore className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => handleArchive(offer)} title={t("offers.archive")}>
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <OfferCreateDialog open={createOpen} onOpenChange={setCreateOpen} editOffer={editOffer} />

      {emailOffer && (
        <OfferEmailDialog
          offer={emailOffer}
          open={!!emailOffer}
          onOpenChange={(open) => { if (!open) setEmailOffer(null); }}
        />
      )}
    </div>
  );
};

export default OffersManager;
