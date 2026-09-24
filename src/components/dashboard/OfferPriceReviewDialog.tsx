/**
 * Price review before an offer is confirmed into reservations.
 *
 * When a resource offers several prices and none matches the space picked on
 * the offer (or the resource has no usable price at all), we must not guess a
 * number and we must not silently create a booking with no price: reports would
 * show it as 0 EUR and it could not be invoiced. This dialog lists every
 * booking the confirmation will create, warns about the ones without a price,
 * and makes staff either pick one of the resource's prices, type an amount, or
 * explicitly decide to leave it empty for now.
 */

import { useMemo, useState } from "react";
import { useT } from "@/contexts/I18nContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import type { OfferPriceReason } from "@/lib/offer-reservation-pricing";

export interface OfferPriceLeg {
  /** Stable key: "main" or the linked-reservation key. */
  key: string;
  reservation_type: string;
  /** Space / sub-service name picked on the offer. */
  space?: string | null;
  /** Resource name backing this leg, when one was found. */
  resourceName?: string | null;
  /** Resource id backing this leg, saved on the created reservation. */
  resourceId?: string | null;
  price: number | null;
  reason: OfferPriceReason;
  candidates: Array<{ name: string; price: number }>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  legs: OfferPriceLeg[];
  /** Called with the final price per leg key (null = leave empty on purpose). */
  onConfirm: (prices: Record<string, number | null>) => void;
  isSubmitting?: boolean;
}

const parseAmount = (raw: string): number | null => {
  const cleaned = raw.replace(",", ".").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};

const OfferPriceReviewDialog = ({
  open,
  onOpenChange,
  legs,
  onConfirm,
  isSubmitting,
}: Props) => {
  const t = useT();

  const missing = useMemo(() => legs.filter((l) => l.price == null), [legs]);

  const [values, setValues] = useState<Record<string, string>>({});
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});

  const legValue = (leg: OfferPriceLeg) =>
    values[leg.key] ?? (leg.price != null ? String(leg.price) : "");

  const legPrice = (leg: OfferPriceLeg): number | null => {
    if (skipped[leg.key]) return null;
    return parseAmount(legValue(leg));
  };

  // Every leg without an automatic price needs either an amount or an explicit
  // "leave empty" decision before staff can continue.
  const unresolved = missing.filter(
    (l) => !skipped[l.key] && legPrice(l) == null,
  );
  const canSubmit = unresolved.length === 0 && !isSubmitting;

  const submit = () => {
    const prices: Record<string, number | null> = {};
    for (const leg of legs) prices[leg.key] = legPrice(leg);
    onConfirm(prices);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("offers.priceReviewTitle")}</DialogTitle>
          <DialogDescription>{t("offers.priceReviewDesc")}</DialogDescription>
        </DialogHeader>

        {missing.length > 0 && (
          <Alert variant="destructive" data-testid="offer-price-warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t("offers.priceReviewWarnTitle")}</AlertTitle>
            <AlertDescription>
              {t("offers.priceReviewWarnDesc")}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 max-h-[50vh] overflow-y-auto">
          {legs.map((leg) => {
            const needsPrice = leg.price == null;
            return (
              <div key={leg.key} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {leg.resourceName || leg.space || leg.reservation_type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {leg.reservation_type}
                      {leg.space ? ` • ${leg.space}` : ""}
                    </p>
                  </div>
                  {needsPrice ? (
                    <Badge variant="destructive" className="text-[10px]">
                      {t("offers.priceReviewNeedsPrice")}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">
                      {t("offers.priceReviewFromResource")}
                    </Badge>
                  )}
                </div>

                {needsPrice && (
                  <p className="text-xs text-muted-foreground">
                    {leg.reason === "ambiguous"
                      ? t("offers.priceReviewReasonAmbiguous")
                      : leg.reason === "no_resource"
                        ? t("offers.priceReviewReasonNoResource")
                        : t("offers.priceReviewReasonUnpriced")}
                  </p>
                )}

                {leg.candidates.length > 0 && !skipped[leg.key] && (
                  <div className="flex flex-wrap gap-1.5">
                    {leg.candidates.map((c) => (
                      <Button
                        key={`${leg.key}-${c.name}`}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setValues((v) => ({
                            ...v,
                            [leg.key]: String(c.price),
                          }))
                        }
                      >
                        {c.name}: {c.price} €
                      </Button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={`price-${leg.key}`}
                    className="text-xs whitespace-nowrap"
                  >
                    {t("offers.priceReviewAmount")}
                  </Label>
                  <Input
                    id={`price-${leg.key}`}
                    inputMode="decimal"
                    className="h-8"
                    disabled={!!skipped[leg.key]}
                    value={legValue(leg)}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [leg.key]: e.target.value }))
                    }
                  />
                </div>

                {needsPrice && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`skip-${leg.key}`}
                      checked={!!skipped[leg.key]}
                      onCheckedChange={(c) =>
                        setSkipped((s) => ({ ...s, [leg.key]: c === true }))
                      }
                    />
                    <Label
                      htmlFor={`skip-${leg.key}`}
                      className="text-xs cursor-pointer"
                    >
                      {t("offers.priceReviewSkip")}
                    </Label>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            data-testid="offer-price-confirm"
          >
            {t("offers.priceReviewConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OfferPriceReviewDialog;
