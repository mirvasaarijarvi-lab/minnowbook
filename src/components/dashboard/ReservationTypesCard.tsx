import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useTierGate } from "@/hooks/useTierGate";
import { useT, useTDynamic } from "@/contexts/I18nContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UtensilsCrossed, Building2, BedDouble, Sparkles, Loader2 } from "lucide-react";

const TYPE_OPTIONS = [
  { id: "restaurant", icon: UtensilsCrossed },
  { id: "venue", icon: Building2 },
  { id: "guesthouse", icon: BedDouble },
  { id: "hotel", icon: BedDouble },
  { id: "custom", icon: Sparkles },
] as const;

const ReservationTypesCard = () => {
  const { tenantId, tenant, isOwner } = useTenant();
  // Use useTierGate so superadmins/system admins automatically bypass the
  // reservation-type cap (effectiveTier=business → maxReservationTypes=null).
  const { limits, isSystemAdmin } = useTierGate();
  const t = useT();
  const tDynamic = useTDynamic();
  const queryClient = useQueryClient();

  const initial = useMemo(
    () => (tenant?.allowed_reservation_types as string[] | null) ?? [],
    [tenant?.allowed_reservation_types],
  );
  const [selected, setSelected] = useState<string[]>(initial);

  useEffect(() => {
    setSelected(initial);
  }, [initial]);

  const max = limits.maxReservationTypes; // null = unlimited (e.g. business or superadmin)

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (max !== null && prev.length >= max) {
        toast.error(t("settings.reservationTypesUpgrade"));
        return prev;
      }
      return [...prev, id];
    });
  };

  const dirty = useMemo(() => {
    if (selected.length !== initial.length) return true;
    const a = [...selected].sort();
    const b = [...initial].sort();
    return a.some((v, i) => v !== b[i]);
  }, [selected, initial]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant");
      if (selected.length === 0) throw new Error(t("settings.reservationTypesDesc"));
      const { error } = await supabase
        .from("tenants")
        .update({ allowed_reservation_types: selected })
        .eq("id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("settings.reservationTypesSaved"));
      queryClient.invalidateQueries({ queryKey: ["tenant-user"] });
      queryClient.invalidateQueries({ queryKey: ["impersonated-tenant"] });
    },
    onError: (err: any) => {
      const msg = String(err?.message ?? "");
      if (msg.includes("at most")) {
        toast.error(t("settings.reservationTypesUpgrade"));
      } else {
        toast.error(msg || t("settings.saveError"));
      }
    },
  });

  if (!tenantId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-serif">{t("settings.reservationTypes")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("settings.reservationTypesDesc")}</p>
        {max !== null && (
          <p className="text-xs text-muted-foreground">
            {t("settings.reservationTypesLimit").replace("{max}", String(max))} ({selected.length}/{max})
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TYPE_OPTIONS.map(({ id, icon: Icon }) => {
            const checked = selected.includes(id);
            const atLimit = max !== null && !checked && selected.length >= max;
            return (
              <label
                key={id}
                className={`flex items-start gap-3 rounded-md border p-3 transition-colors ${
                  checked ? "border-primary bg-primary/5" : "border-border"
                } ${atLimit || !isOwner ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-muted/40"}`}
              >
                <Checkbox
                  checked={checked}
                  disabled={atLimit || !isOwner}
                  onCheckedChange={() => toggle(id)}
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <Label className="font-medium cursor-pointer">{tDynamic(`dashboard.${id}`)}</Label>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() => mutation.mutate()}
            disabled={!dirty || mutation.isPending || selected.length === 0 || !isOwner}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("common.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReservationTypesCard;
