import { useEffect, useState, useMemo } from "react";
import { useT } from "@/contexts/I18nContext";
import { useCreateOffer, useUpdateOffer, type Offer, type LinkedReservation } from "@/hooks/useOffers";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDateLocale } from "@/hooks/useDateLocale";

const allTimes: string[] = [];
for (let h = 6; h <= 23; h++) {
  allTimes.push(`${String(h).padStart(2, "0")}:00`);
  allTimes.push(`${String(h).padStart(2, "0")}:30`);
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editOffer?: Offer | null;
}

const OfferCreateDialog = ({ open, onOpenChange, editOffer }: Props) => {
  const t = useT();
  const { user } = useAuth();
  const { tenantId, tenant } = useTenant();
  const dateLocale = useDateLocale();
  const createOffer = useCreateOffer();
  const updateOffer = useUpdateOffer();
  const isEditing = !!editOffer;

  // Fetch venue resources for event space dropdown
  const { data: venues = [] } = useQuery({
    queryKey: ["venue-resources", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("resources")
        .select("name, resource_type")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .in("resource_type", ["venue"]);
      return data?.map((r) => r.name) || [];
    },
    enabled: !!tenantId,
  });

  // Fetch resource types for linked reservations (dynamic from tenant's resources)
  const { data: resourceTypes = [] } = useQuery({
    queryKey: ["resource-types-for-offers", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("resources")
        .select("resource_type")
        .eq("tenant_id", tenantId)
        .eq("is_active", true);
      const types = [...new Set(data?.map((r) => r.resource_type) || [])];
      return types;
    },
    enabled: !!tenantId,
  });

  const [form, setForm] = useState(() => initForm(editOffer));
  const [linked, setLinked] = useState<Record<string, LinkedReservation>>(() => initLinked(editOffer));

  function initForm(offer?: Offer | null) {
    return {
      validity_date: offer?.validity_date || "",
      guest_name: offer?.guest_name || "",
      guest_email: offer?.guest_email || "",
      guest_phone: offer?.guest_phone || "",
      event_date: offer?.event_date ? parseISO(offer.event_date) : (undefined as Date | undefined),
      start_time: offer?.start_time || "",
      end_time: offer?.end_time || "",
      guests_count: offer?.guests_count?.toString() || "",
      event_space: offer?.event_space || "",
      event_type: offer?.event_type || "",
      invoicing_details: offer?.invoicing_details || "",
      special_requests: offer?.special_requests || "",
      menu: offer?.menu || "",
      language: offer?.language || "en",
    };
  }

  function initLinked(offer?: Offer | null): Record<string, LinkedReservation> {
    if (offer?.linked_reservations && typeof offer.linked_reservations === "object") {
      return offer.linked_reservations as Record<string, LinkedReservation>;
    }
    return {};
  }

  useEffect(() => {
    if (!open) return;
    setForm(initForm(editOffer));
    setLinked(initLinked(editOffer));
  }, [open, editOffer]);

  const updateField = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleLinked = (key: string, checked: boolean) => {
    setLinked((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled: checked, resource_type: key },
    }));
  };

  const updateLinkedField = (key: string, field: string, value: any) => {
    setLinked((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const handleSave = async () => {
    if (!form.guest_name || !form.guest_email || !form.guest_phone || !form.event_date || !form.start_time || !form.guests_count || !form.event_space) {
      toast.error(t("offers.fillRequired"));
      return;
    }

    const payload = {
      status: (editOffer?.status || "draft") as any,
      validity_date: form.validity_date || null,
      guest_name: form.guest_name,
      guest_email: form.guest_email,
      guest_phone: form.guest_phone,
      event_date: format(form.event_date!, "yyyy-MM-dd"),
      start_time: form.start_time,
      end_time: form.end_time || null,
      guests_count: parseInt(form.guests_count),
      event_space: form.event_space,
      event_type: form.event_type || null,
      invoicing_details: form.invoicing_details || null,
      special_requests: form.special_requests || null,
      menu: form.menu || null,
      linked_reservations: linked as any,
      created_by: user?.id || null,
      language: form.language,
    };

    try {
      if (isEditing) {
        await updateOffer.mutateAsync({ id: editOffer!.id, ...payload });
      } else {
        await createOffer.mutateAsync(payload);
      }
      toast.success(t("offers.saved"));
      onOpenChange(false);
    } catch {
      toast.error(t("offers.saveError"));
    }
  };

  const enabledLinked = resourceTypes.filter((k) => linked[k]?.enabled);

  // Resource type labels for linked reservations
  const typeLabels: Record<string, string> = {
    hotel: t("dashboard.hotel"),
    guesthouse: t("dashboard.guesthouse"),
    restaurant: t("dashboard.restaurant"),
    venue: t("dashboard.venue"),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? t("offers.edit") : t("offers.create")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Validity */}
          <div className="space-y-1.5">
            <Label>{t("offers.validity")}</Label>
            <Input value={form.validity_date} onChange={(e) => updateField("validity_date", e.target.value)} placeholder={t("offers.validityPlaceholder")} />
          </div>

          {/* Customer info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("common.name")} *</Label>
              <Input value={form.guest_name} onChange={(e) => updateField("guest_name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("common.email")} *</Label>
              <Input type="email" value={form.guest_email} onChange={(e) => updateField("guest_email", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("common.phone")} *</Label>
              <Input type="tel" value={form.guest_phone} onChange={(e) => updateField("guest_phone", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("offers.language")}</Label>
              <Select value={form.language} onValueChange={(v) => updateField("language", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="fi">Suomi</SelectItem>
                  <SelectItem value="sv">Svenska</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>{t("common.date")} *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.event_date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.event_date ? format(form.event_date, "PPP", { locale: dateLocale }) : t("common.date")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={form.event_date} onSelect={(d) => updateField("event_date", d)} locale={dateLocale} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label>{t("offers.startTime")} *</Label>
              <Select value={form.start_time} onValueChange={(v) => updateField("start_time", v)}>
                <SelectTrigger><SelectValue placeholder="HH:MM" /></SelectTrigger>
                <SelectContent>
                  {allTimes.map((t2) => (
                    <SelectItem key={t2} value={t2}>{t2}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("offers.endTime")}</Label>
              <Select value={form.end_time || "none"} onValueChange={(v) => updateField("end_time", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="–" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">–</SelectItem>
                  {allTimes.map((t2) => (
                    <SelectItem key={t2} value={t2}>{t2}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Guests & Space */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("common.guests")} *</Label>
              <Input type="number" min={1} value={form.guests_count} onChange={(e) => updateField("guests_count", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("offers.eventSpace")} *</Label>
              {venues.length > 0 ? (
                <Select value={form.event_space} onValueChange={(v) => updateField("event_space", v)}>
                  <SelectTrigger><SelectValue placeholder={t("offers.selectSpace")} /></SelectTrigger>
                  <SelectContent>
                    {venues.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={form.event_space} onChange={(e) => updateField("event_space", e.target.value)} placeholder={t("offers.selectSpace")} />
              )}
            </div>
          </div>

          {/* Event type & invoicing */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("offers.eventType")}</Label>
              <Input value={form.event_type} onChange={(e) => updateField("event_type", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("offers.invoicing")}</Label>
              <Input value={form.invoicing_details} onChange={(e) => updateField("invoicing_details", e.target.value)} />
            </div>
          </div>

          {/* Linked reservations (dynamic from resource types) */}
          {resourceTypes.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">{t("offers.linkedReservations")}</Label>
              <div className="grid grid-cols-2 gap-2">
                {resourceTypes.map((key) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={!!linked[key]?.enabled} onCheckedChange={(v) => toggleLinked(key, !!v)} />
                    {typeLabels[key] || key}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Linked reservation details */}
          {enabledLinked.map((key) => (
            <div key={key} className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <h4 className="font-medium text-sm">{typeLabels[key] || key}</h4>
              <div className="space-y-1.5">
                <Label>{t("offers.specialRequests")}</Label>
                <Textarea value={linked[key]?.special_requests || ""} onChange={(e) => updateLinkedField(key, "special_requests", e.target.value)} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label>Menu</Label>
                <Textarea value={linked[key]?.menu || ""} onChange={(e) => updateLinkedField(key, "menu", e.target.value)} rows={3} />
              </div>
            </div>
          ))}

          {/* Special requests */}
          <div className="space-y-1.5">
            <Label>{t("offers.specialRequests")}</Label>
            <Textarea value={form.special_requests} onChange={(e) => updateField("special_requests", e.target.value)} rows={3} />
          </div>

          {/* Menu */}
          <div className="space-y-1.5">
            <Label>Menu</Label>
            <Textarea value={form.menu} onChange={(e) => updateField("menu", e.target.value)} rows={6} placeholder={t("offers.menuPlaceholder")} />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={createOffer.isPending || updateOffer.isPending}>
            {isEditing ? t("common.save") : t("offers.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OfferCreateDialog;
