import { useMemo, useState, type ReactNode } from "react";
import { format, parseISO, isValid } from "date-fns";
import { Printer } from "lucide-react";

import { useTenant } from "@/hooks/useTenant";
import { useTierGate } from "@/hooks/useTierGate";
import { useAnalyticsT } from "@/i18n/analytics";
import {
  ReportsPeriodContext,
  periodLabel,
  printReports,
  rangeForPreset,
  useReportsPeriod,
  type PeriodPreset,
  type ReportsPeriod,
} from "@/lib/reports-period";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PRESETS: Exclude<PeriodPreset, "custom">[] = [
  "week",
  "month",
  "quarter",
  "year",
];

/** Wraps the Reports page: shared period picker, print controls, cover. */
export function ReportsWorkspace({ children }: { children: ReactNode }) {
  const t = useAnalyticsT();
  const { tenant } = useTenant();
  const canPrint = !useTierGate().isGated("basic");
  const [preset, setPresetState] = useState<PeriodPreset>("month");
  const [range, setRange] = useState(() => rangeForPreset("month"));

  const value: ReportsPeriod = useMemo(
    () => ({
      preset,
      start: range.start,
      end: range.end,
      startStr: format(range.start, "yyyy-MM-dd"),
      endStr: format(range.end, "yyyy-MM-dd"),
      label: periodLabel(range.start, range.end),
      setPreset: (p) => {
        setPresetState(p);
        setRange(rangeForPreset(p));
      },
      setCustom: (start, end) => {
        setPresetState("custom");
        setRange(start <= end ? { start, end } : { start: end, end: start });
      },
    }),
    [preset, range],
  );

  const onDate = (which: "start" | "end", raw: string) => {
    const d = parseISO(raw);
    if (!isValid(d)) return;
    value.setCustom(
      which === "start" ? d : range.start,
      which === "end" ? d : range.end,
    );
  };

  const businessName =
    (tenant as { name?: string } | null | undefined)?.name ?? "";

  return (
    <ReportsPeriodContext.Provider value={value}>
      <div id="reports-workspace" className="space-y-6">
        <div className="print-hide flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
          <div className="space-y-1">
            <Label htmlFor="rp-preset" className="text-xs">
              {t("rp.period")}
            </Label>
            <Select
              value={preset}
              onValueChange={(v) => {
                if (v !== "custom")
                  value.setPreset(v as Exclude<PeriodPreset, "custom">);
              }}
            >
              <SelectTrigger id="rp-preset" className="h-9 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {t(`rp.${p}`)}
                  </SelectItem>
                ))}
                <SelectItem value="custom" disabled>
                  {t("rp.custom")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="rp-from" className="text-xs">
              {t("rp.from")}
            </Label>
            <Input
              id="rp-from"
              type="date"
              className="h-9 w-40"
              value={value.startStr}
              onChange={(e) => onDate("start", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rp-to" className="text-xs">
              {t("rp.to")}
            </Label>
            <Input
              id="rp-to"
              type="date"
              className="h-9 w-40"
              value={value.endStr}
              onChange={(e) => onDate("end", e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("rp.help")}</p>
          {canPrint && (
            <Button className="ml-auto" onClick={() => printReports()}>
              <Printer className="mr-2 h-4 w-4" aria-hidden />
              {t("rp.printAll")}
            </Button>
          )}
        </div>

        <div className="print-only mb-4 border-b pb-2">
          <p className="text-lg font-semibold">
            {businessName ? `${businessName}, ` : ""}
            {t("rp.coverTitle")}
          </p>
          <p className="text-sm">
            {t("rp.period")}: {value.label}
          </p>
        </div>

        {children}
      </div>
    </ReportsPeriodContext.Provider>
  );
}

/** One printable section of the Reports page with its own print button. */
export function PrintSection({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const t = useAnalyticsT();
  const period = useReportsPeriod();
  const canPrint = !useTierGate().isGated("basic");
  return (
    <section data-print-section={id} className="print-section relative">
      {canPrint && (
        <div className="print-hide mb-1 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => printReports(id)}
            aria-label={t("rp.printSection")}
          >
            <Printer className="mr-1 h-4 w-4" aria-hidden />
            {t("rp.printSection")}
          </Button>
        </div>
      )}
      {period && (
        <p className="print-only text-xs">
          {t("rp.period")}: {period.label}
        </p>
      )}
      {children}
    </section>
  );
}
