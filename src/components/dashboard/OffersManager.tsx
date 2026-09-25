import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
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
import {
  Plus,
  FileText,
  Check,
  Send,
  Printer,
  Archive,
  ArchiveRestore,
  Search,
  Clock,
  XCircle,
  RotateCcw,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  describeOfferReservationPrice,
  pickOfferResource,
} from "@/lib/offer-reservation-pricing";
import { offerKitchenMessage } from "@/lib/offer-kitchen-message";
import {
  buildKitchenOrderRows,
  type OfferMenuLeg,
} from "@/lib/offer-kitchen-orders";
import {
  checkKitchenPreviewMatchesOutput,
  formatKitchenMismatches,
} from "@/lib/offer-kitchen-consistency";
import {
  announceOfferStatus,
  composeOfferStatusMessage,
} from "@/lib/offer-status-announcer";
import { focusOfferStatusPanel } from "@/lib/offer-status-focus";
import {
  OFFER_TRACK_STATUSES,
  expiresSoon,
  offerTrackStatus,
  type OfferTrackStatus,
} from "@/lib/offer-status";

import OfferCreateDialog from "./OfferCreateDialog";
import OfferEmailDialog from "./OfferEmailDialog";
import OfferPriceReviewDialog, {
  type OfferPriceLeg,
} from "./OfferPriceReviewDialog";
import { useDateLocale } from "@/hooks/useDateLocale";
import DashboardTooltip from "./DashboardTooltip";

interface ConfirmPlan {
  mainType: string;
  legs: OfferPriceLeg[];
}

const OffersManager = () => {
  const t = useT();
  const dateLocale = useDateLocale();
  const { tenantId, tenant } = useTenant();
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: offers = [], isLoading } = useOffers(showArchived);
  const updateOffer = useUpdateOffer();
  const [createOpen, setCreateOpen] = useState(false);
  const [emailOffer, setEmailOffer] = useState<Offer | null>(null);
  const [editOffer, setEditOffer] = useState<Offer | null>(null);
  const [priceReview, setPriceReview] = useState<{
    offer: Offer;
    plan: ConfirmPlan;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);

  // The confirm result is kept on screen in a focusable panel: the Confirm
  // button disappears once the offer is confirmed, so focus is moved here
  // instead of being dropped on the document body.
  const [confirmStatus, setConfirmStatus] = useState<{
    message: string;
    urgent: boolean;
    seq: number;
  } | null>(null);
  const statusPanelRef = useRef<HTMLDivElement | null>(null);
  const confirmTriggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!confirmStatus) return;
    focusOfferStatusPanel({
      panel: statusPanelRef.current,
      active: document.activeElement,
      trigger: confirmTriggerRef.current,
    });
  }, [confirmStatus]);

  const publishConfirmStatus = useCallback(
    (message: string, urgent: boolean) => {
      if (!message.trim()) return;
      setConfirmStatus((prev) => ({
        message,
        urgent,
        seq: (prev?.seq ?? 0) + 1,
      }));
      announceOfferStatus(message, urgent ? "assertive" : "polite");
    },
    [],
  );

  const [statusFilter, setStatusFilter] = useState<OfferTrackStatus | "all">(
    "all",
  );
  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const o of offers) {
      const s = offerTrackStatus(o);
      c[s] = (c[s] ?? 0) + 1;
    }
    return c;
  }, [offers]);

  const filteredOffers = useMemo(() => {
    const byStatus =
      statusFilter === "all"
        ? offers
        : offers.filter((o) => offerTrackStatus(o) === statusFilter);
    if (!searchQuery.trim()) return byStatus;
    const q = searchQuery.toLowerCase().trim();
    return byStatus.filter((offer) => {
      const nameMatch = offer.guest_name.toLowerCase().includes(q);
      const dateMatch =
        offer.event_date.includes(q) ||
        format(parseISO(offer.event_date), "d.M.yyyy").includes(q);
      const spaceMatch = offer.event_space.toLowerCase().includes(q);
      return nameMatch || dateMatch || spaceMatch;
    });
  }, [offers, searchQuery, statusFilter]);

  // Derive a "stale" map for confirmed offers: when every linked reservation
  // has been cancelled, surface a badge so staff can see the offer is no
  // longer backing any active booking. We don't mutate offer.status because
  // the schema constrains it (draft|sent|confirmed|expired) and a soft
  // signal is enough for the UI.
  const offerResIds = useMemo(() => {
    const ids = new Set<string>();
    for (const o of filteredOffers) {
      if (o.status !== "confirmed") continue;
      for (const id of o.reservation_ids ?? []) ids.add(id);
    }
    return Array.from(ids);
  }, [filteredOffers]);

  const { data: resStatuses = [] } = useQuery({
    queryKey: ["offer-linked-reservation-statuses", tenantId, offerResIds],
    queryFn: async () => {
      if (!tenantId || offerResIds.length === 0) return [];
      const { data, error } = await supabase
        .from("reservations")
        .select("id, status")
        .eq("tenant_id", tenantId)
        .in("id", offerResIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId && offerResIds.length > 0,
  });

  const statusById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of resStatuses as any[]) m.set(r.id, r.status);
    return m;
  }, [resStatuses]);

  const isOfferStale = useCallback(
    (offer: Offer) => {
      if (offer.status !== "confirmed") return false;
      const ids = offer.reservation_ids ?? [];
      if (ids.length === 0) return false;
      return ids.every((id) => statusById.get(id) === "cancelled");
    },
    [statusById],
  );

  const statusColor = (s: OfferTrackStatus) => {
    switch (s) {
      case "accepted":
      case "pending":
        return "default" as const;
      case "expired":
      case "declined":
        return "destructive" as const;
      default:
        return "secondary" as const;
    }
  };

  const setDecision = async (offer: Offer, declined: boolean) => {
    try {
      await updateOffer.mutateAsync({
        id: offer.id,
        status: declined ? "declined" : offer.last_sent_at ? "sent" : "draft",
        declined_at: declined ? new Date().toISOString() : null,
      } as any);
      toast.success(
        t(declined ? "offers.declinedSuccess" : "offers.reopenedSuccess"),
      );
    } catch {
      toast.error(t("offers.saveError"));
    }
  };

  const handleArchive = async (offer: Offer) => {
    try {
      await updateOffer.mutateAsync({
        id: offer.id,
        archived_at: new Date().toISOString(),
      } as any);
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

  /**
   * Work out, without writing anything, which reservations a confirmation
   * would create and what each of them would cost according to the resource
   * configuration. Legs whose price cannot be resolved unambiguously are
   * flagged so staff can choose a price instead of getting an empty total.
   */
  const buildConfirmPlan = async (offer: Offer): Promise<ConfirmPlan> => {
    // Load the tenant's resource configuration once so every reservation
    // created here is priced from the same source of truth the public
    // booking flow uses (room price per night, sub-service prices).
    const { data: resourceRows } = await supabase
      .from("resources")
      .select(
        "id, name, resource_type, price_per_night, breakfast_price_per_person, sub_services",
      )
      .eq("tenant_id", offer.tenant_id)
      .eq("is_active", true);
    const resources = (resourceRows ?? []) as any[];

    // Resolve the main reservation_type: look up the resource by name,
    // otherwise fall back to the tenant's first allowed type, then "venue".
    let mainType = "venue";
    const mainResource = pickOfferResource(resources, {
      name: offer.event_space,
      reservation_type: mainType,
    });
    if (offer.event_space && mainResource?.resource_type) {
      mainType = mainResource.resource_type;
    }
    if (mainType === "venue") {
      const allowed =
        (tenant?.allowed_reservation_types as string[] | undefined) ?? [];
      if (!allowed.includes("venue") && allowed.length > 0) {
        mainType = allowed[0];
      }
    }

    const mainPriceResource = pickOfferResource(resources, {
      name: offer.event_space,
      reservation_type: mainType,
    });
    const mainDesc = describeOfferReservationPrice({
      reservation_type: mainType,
      resource: mainPriceResource,
      space: offer.event_space,
    });

    const legs: OfferPriceLeg[] = [
      {
        key: "main",
        reservation_type: mainType,
        space: offer.event_space,
        resourceName: mainPriceResource?.name ?? null,
        resourceId: mainPriceResource?.id ?? null,
        ...mainDesc,
      },
    ];

    const linked = offer.linked_reservations || {};
    for (const [key, lr] of Object.entries(linked)) {
      if (!lr.enabled) continue;
      const resType = lr.resource_type || key;
      const resource = pickOfferResource(resources, {
        name: lr.space,
        reservation_type: resType,
      });
      legs.push({
        key,
        reservation_type: resType,
        space: lr.space ?? null,
        resourceName: resource?.name ?? null,
        resourceId: resource?.id ?? null,
        ...describeOfferReservationPrice({
          reservation_type: resType,
          resource,
          space: lr.space,
        }),
      });
    }

    return { mainType, legs };
  };

  /** Create the reservations for an offer with the given per-leg prices. */
  const executeConfirm = async (
    offer: Offer,
    plan: ConfirmPlan,
    prices: Record<string, number | null>,
  ) => {
    try {
      // Stamp every reservation created from this offer with a shared
      // linked_group_id so the edit dialog can show them as one bundle even
      // if the offer row is later archived.
      const linkedGroupId = crypto.randomUUID();
      const mainPrice = prices.main ?? null;

      const mainRow = {
        tenant_id: offer.tenant_id,
        reservation_type: plan.mainType,
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
        resource_id:
          plan.legs.find((l) => l.key === "main")?.resourceId ?? null,
        special_requests: offer.special_requests || null,
        staff_notes: "Offer to Reservation",
        language: offer.language || "en",
        linked_group_id: linkedGroupId,
        ...(mainPrice != null ? { price_eur: mainPrice } : {}),
      };

      // An offer made from a public booking turns that same booking into the
      // full reservation, so the guest never ends up with two bookings.
      let mainRes: any = null;
      if (offer.source_reservation_id) {
        const { tenant_id: _tenant, ...updateRow } = mainRow;
        const { data, error } = await supabase
          .from("reservations")
          .update({
            ...updateRow,
            staff_notes: "Public booking, confirmed via offer",
          } as any)
          .eq("id", offer.source_reservation_id)
          .eq("tenant_id", offer.tenant_id)
          .select()
          .maybeSingle();
        if (error) throw error;
        mainRes = data;
      }
      if (!mainRes) {
        const { data, error: mainErr } = await supabase
          .from("reservations")
          .insert(mainRow as any)
          .select()
          .single();
        if (mainErr) throw mainErr;
        mainRes = data;
      }
      const resIds = [mainRes.id];

      // Legs whose menu text becomes kitchen order lines.
      const menuLegs: OfferMenuLeg[] = [
        {
          reservationId: mainRes.id,
          reservationType: plan.mainType,
          menu: offer.menu,
        },
      ];

      // Create linked reservations
      const linked = offer.linked_reservations || {};
      for (const [key, lr] of Object.entries(linked)) {
        if (!lr.enabled) continue;
        const resType = lr.resource_type || key;
        const linkedPrice = prices[key] ?? null;

        const { data: linkedRes, error: linkedErr } = await supabase
          .from("reservations")
          .insert({
            tenant_id: offer.tenant_id,
            reservation_type: resType,
            status: "confirmed",
            date: offer.event_date,
            start_time: lr.start_time
              ? `${lr.start_time}:00`
              : offer.start_time
                ? `${offer.start_time}:00`
                : null,
            end_time: lr.end_time ? `${lr.end_time}:00` : null,
            guest_name: offer.guest_name,
            guest_email: offer.guest_email,
            guest_phone: offer.guest_phone,
            guests_count: lr.guests_count || offer.guests_count,
            event_type: offer.event_type || null,
            room_type: lr.space || null,
            resource_id:
              plan.legs.find((l) => l.key === key)?.resourceId ?? null,
            special_requests: lr.special_requests
              ? `Cross-reservation via offer\n${lr.special_requests}`
              : "Cross-reservation via offer",
            staff_notes: "Cross-reservation, offer",
            language: offer.language || "en",
            linked_group_id: linkedGroupId,
            ...(linkedPrice != null ? { price_eur: linkedPrice } : {}),
          } as any)
          .select()
          .single();

        if (linkedErr) throw linkedErr;
        resIds.push(linkedRes.id);
        menuLegs.push({
          reservationId: linkedRes.id,
          reservationType: resType,
          menu: (lr as any).menu ?? null,
        });
      }

      // Forward the agreed menu to the Kitchen tab. A failure here must not
      // undo the reservations, so staff are warned instead.
      const kitchenRows = buildKitchenOrderRows(offer.tenant_id, menuLegs);

      // Guard: what we are about to write must match the preview shown on the
      // offer form for the very same menu fields.
      const consistency = checkKitchenPreviewMatchesOutput(
        offer.tenant_id,
        menuLegs.map((leg) => ({
          key: leg.reservationId ?? "",
          name: leg.reservationType,
          reservationType: leg.reservationType,
          menu: leg.menu,
        })),
        kitchenRows,
      );
      if (!consistency.ok) {
        console.warn(
          "Offer kitchen preview and output differ:",
          formatKitchenMismatches(consistency),
        );
      }

      let kitchenFailed = false;
      if (kitchenRows.length > 0) {
        const { error: kitchenErr } = await supabase
          .from("kitchen_orders")
          .insert(kitchenRows as any);
        if (kitchenErr) {
          kitchenFailed = true;
          toast.warning(t("offers.kitchenOrdersFailed"));
        }
      }

      await updateOffer.mutateAsync({
        id: offer.id,
        status: "confirmed",
        accepted_at: new Date().toISOString(),
        reservation_ids: resIds,
      });

      const missingPrice = plan.legs.filter(
        (l) => (prices[l.key] ?? null) == null,
      );
      const kitchenDescription = offerKitchenMessage(
        kitchenRows.length,
        (key) => t(key),
      );
      toast.success(t("offers.confirmedSuccess"), {
        description: kitchenDescription,
      });
      if (missingPrice.length > 0) {
        toast.warning(t("offers.confirmedWithoutPrice"));
      }
      // Screen readers get the same outcome, including the Kitchen tab result.
      publishConfirmStatus(
        composeOfferStatusMessage([
          t("offers.confirmedSuccess"),
          kitchenFailed
            ? t("offers.kitchenOrdersFailedAnnounce")
            : kitchenDescription,
          missingPrice.length > 0
            ? t("offers.confirmedWithoutPriceAnnounce")
            : null,
        ]),
        kitchenFailed || missingPrice.length > 0,
      );
    } catch {
      toast.error(t("offers.confirmError"));
      publishConfirmStatus(t("offers.confirmErrorAnnounce"), true);
    }
  };

  const handleConfirm = async (offer: Offer) => {
    // Remember where focus was, so the status panel only takes focus when the
    // user has not moved on to something else in the meantime.
    confirmTriggerRef.current = document.activeElement;
    let plan: ConfirmPlan;
    try {
      plan = await buildConfirmPlan(offer);
    } catch {
      toast.error(t("offers.confirmError"));
      publishConfirmStatus(t("offers.confirmErrorAnnounce"), true);
      return;
    }

    // Any leg without an unambiguous resource price must be decided by staff
    // before we create bookings that would otherwise show up as 0 EUR.
    if (plan.legs.some((l) => l.price == null)) {
      setPriceReview({ offer, plan });
      return;
    }

    const prices: Record<string, number | null> = {};
    for (const leg of plan.legs) prices[leg.key] = leg.price;
    await executeConfirm(offer, plan, prices);
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
          <h3 className="text-xl sm:text-2xl font-serif font-bold text-foreground">
            {t("offers.title")}
          </h3>
          <DashboardTooltip text={t("offers.tooltip")} />
        </div>
        <Button
          onClick={() => {
            setEditOffer(null);
            setCreateOpen(true);
          }}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          {t("offers.create")}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label={t("offers.searchLabel")}
            placeholder={t("offers.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={showArchived}
            onCheckedChange={setShowArchived}
            id="show-archived"
          />
          <Label htmlFor="show-archived" className="text-sm cursor-pointer">
            {t("offers.showArchived")}
          </Label>
        </div>
      </div>

      <div
        role="group"
        aria-label={t("offers.filterLabel")}
        className="flex flex-wrap gap-1.5"
      >
        {(["all", ...OFFER_TRACK_STATUSES] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? "default" : "outline"}
            aria-pressed={statusFilter === s}
            onClick={() => setStatusFilter(s)}
          >
            {t(`offers.track_${s}` as any)}
            <span className="ml-1.5 text-xs opacity-75">
              {s === "all" ? offers.length : (statusCounts[s] ?? 0)}
            </span>
          </Button>
        ))}
      </div>

      {confirmStatus && (
        <div
          key={confirmStatus.seq}
          ref={statusPanelRef}
          tabIndex={-1}
          role="group"
          aria-label={t("offers.statusRegionLabel")}
          className={`rounded-md border p-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
            confirmStatus.urgent
              ? "border-destructive/40 bg-destructive/10 text-foreground"
              : "border-border bg-muted/50 text-foreground"
          }`}
        >
          {confirmStatus.message}
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
      ) : filteredOffers.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            {searchQuery.trim() ? t("offers.noResults") : t("offers.empty")}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2 list-none p-0 m-0">
          {filteredOffers.map((offer) => {
            const isArchived = !!offer.archived_at;
            const track = offerTrackStatus(offer);
            const isOpen = track === "pending" || track === "draft";
            return (
              <li key={offer.id}>
                <Card
                  className={`hover:shadow-sm transition-shadow ${isArchived ? "opacity-60" : ""}`}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">
                            {offer.guest_name}
                          </span>
                          <Badge
                            variant={statusColor(track)}
                            className="text-[10px]"
                          >
                            {t(`offers.track_${track}` as any)}
                          </Badge>
                          {expiresSoon(offer) && (
                            <Badge variant="outline" className="text-[10px]">
                              {t("offers.expiresSoon")}
                            </Badge>
                          )}
                          {isArchived && (
                            <Badge variant="outline" className="text-[10px]">
                              {t("offers.archived")}
                            </Badge>
                          )}
                          {isOfferStale(offer) && (
                            <Badge
                              variant="destructive"
                              className="text-[10px]"
                              title="All linked reservations have been cancelled"
                            >
                              All bookings cancelled
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(offer.event_date), "PPP", {
                            locale: dateLocale,
                          })}{" "}
                          • {offer.start_time}
                          {offer.end_time ? ` – ${offer.end_time}` : ""} •{" "}
                          {offer.guests_count}{" "}
                          {t("common.guests").toLowerCase()} •{" "}
                          {offer.event_space}
                        </p>
                        {offer.expires_on && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {t("offers.validUntil")}:{" "}
                            {format(parseISO(offer.expires_on), "d.M.yyyy")}
                          </p>
                        )}
                        {offer.last_sent_at && (
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {t("offers.lastSent")}:{" "}
                            {format(
                              parseISO(offer.last_sent_at),
                              "d.M.yyyy HH:mm",
                              { locale: dateLocale },
                            )}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePrintPdf(offer)}
                          title="PDF"
                          aria-label={`${t("offers.printPdf")}: ${offer.guest_name}`}
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditOffer(offer);
                            setCreateOpen(true);
                          }}
                        >
                          <FileText className="h-3.5 w-3.5 mr-1" />
                          {t("common.edit")}
                        </Button>
                        {isOpen && !isArchived && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEmailOffer(offer)}
                          >
                            <Send className="h-3.5 w-3.5 mr-1" />
                            {t("offers.send")}
                          </Button>
                        )}
                        {isOpen && !isArchived && (
                          <Button
                            size="sm"
                            onClick={() => handleConfirm(offer)}
                          >
                            <Check className="h-3.5 w-3.5 mr-1" />
                            {t("offers.confirm")}
                          </Button>
                        )}
                        {isOpen && !isArchived && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDecision(offer, true)}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            {t("offers.markDeclined")}
                          </Button>
                        )}
                        {offer.status === "declined" && !isArchived && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDecision(offer, false)}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            {t("offers.reopen")}
                          </Button>
                        )}
                        {isArchived ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUnarchive(offer)}
                            title={t("offers.unarchive")}
                            aria-label={`${t("offers.unarchive")}: ${offer.guest_name}`}
                          >
                            <ArchiveRestore className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleArchive(offer)}
                            title={t("offers.archive")}
                            aria-label={`${t("offers.archive")}: ${offer.guest_name}`}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <OfferCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        editOffer={editOffer}
      />

      {emailOffer && (
        <OfferEmailDialog
          offer={emailOffer}
          open={!!emailOffer}
          onOpenChange={(open) => {
            if (!open) setEmailOffer(null);
          }}
        />
      )}

      {priceReview && (
        <OfferPriceReviewDialog
          open={!!priceReview}
          onOpenChange={(open) => {
            if (!open) setPriceReview(null);
          }}
          legs={priceReview.plan.legs}
          isSubmitting={confirming}
          onConfirm={async (prices) => {
            const { offer, plan } = priceReview;
            setConfirming(true);
            try {
              await executeConfirm(offer, plan, prices);
            } finally {
              setConfirming(false);
              setPriceReview(null);
            }
          }}
        />
      )}
    </div>
  );
};

export default OffersManager;
