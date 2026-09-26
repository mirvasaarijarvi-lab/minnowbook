import { periodInSiteScope } from "@/lib/staffing/siteScope";
import { useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import {
  FileSpreadsheet,
  History,
  Plus,
  Printer,
  RotateCcw,
  Settings2,
  Trash2,
  Users,
  FileDown,
  SearchX,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenant } from "@/hooks/useTenant";
import { useTierGate } from "@/hooks/useTierGate";
import { useSiteContext } from "@/hooks/useSiteContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useStaffRoles,
  useStaffMembers,
  useShiftPeriods,
  usePeriodData,
  useShiftMutations,
  useStaffingSettings,
  type StaffRole,
  type ShiftRow,
  fetchPayrollRange,
} from "@/hooks/useShiftList";
import {
  computeRowTotals,
  formatShiftCell,
  isSundayWorkDay,
  parseShiftInput,
  type ShiftCell,
} from "@/lib/staffing/shiftList";
import { filterShiftSlots } from "@/lib/staffing/shiftSlotFilter";
import {
  focusAdjacentShiftField,
  focusShiftFieldByArrow,
} from "@/lib/staffing/shiftFieldNavigation";
import { buildPayroll, toCsv } from "@/lib/staffing/shiftPayroll";
import { sanitizePathSegment } from "@/lib/sanitize-path";
import { STAFF_LABELS, type StaffLang } from "@/lib/staffing/labels";
import StaffRegisterDialog from "./StaffRegisterDialog";
import StaffingSettingsDialog from "./StaffingSettingsDialog";
import ShiftHistoryDialog from "./ShiftHistoryDialog";

const NONE = "__none__";
const roleName = (r: StaffRole | undefined, lang: StaffLang) =>
  r ? (lang === "fi" ? r.name_fi : lang === "sv" ? r.name_sv : r.name_en) : "";
const toCell = (s: ShiftRow | undefined): ShiftCell | null =>
  s && (s.code || s.start_time)
    ? {
        start_time: s.start_time?.slice(0, 5) ?? null,
        end_time: s.end_time?.slice(0, 5) ?? null,
        code: s.code,
      }
    : null;
const toActualCell = (s: ShiftRow | undefined): ShiftCell | null =>
  s?.actual_start_time && s.actual_end_time
    ? {
        start_time: s.actual_start_time.slice(0, 5),
        end_time: s.actual_end_time.slice(0, 5),
        code: null,
      }
    : s?.code
      ? { start_time: null, end_time: null, code: s.code }
      : null;

const download = (text: string, name: string) => {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizePathSegment(name)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const CellInput = ({
  value,
  onCommit,
  placeholder,
  disabled,
  label,
}: {
  value: string;
  onCommit: (v: string) => boolean;
  placeholder?: string;
  disabled?: boolean;
  label: string;
}) => {
  const [v, setV] = useState(value);
  const [bad, setBad] = useState(false);
  useEffect(() => {
    setV(value);
    setBad(false);
  }, [value]);
  return (
    <input
      value={v}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={label}
      data-shift-field
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v !== value) setBad(!onCommit(v));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (
          e.key === "Tab" &&
          focusAdjacentShiftField(e.currentTarget, e.shiftKey)
        )
          e.preventDefault();
        if (
          e.key.startsWith("Arrow") &&
          focusShiftFieldByArrow(e.currentTarget, e.key)
        )
          e.preventDefault();
      }}
      className={`w-full min-w-[3.2rem] bg-transparent px-1 py-1 text-center text-[11px] outline-none focus:bg-accent/40 disabled:opacity-60 ${bad ? "text-destructive" : ""}`}
    />
  );
};

export default function ShiftListTab({ lang }: { lang: StaffLang }) {
  const L = STAFF_LABELS[lang];
  const { isAdmin, tenant, tenantId } = useTenant();
  const { isGated } = useTierGate();
  const proLocked = isGated("basic");
  const bizLocked = isGated("basic", "professional");
  const { data: roles = [] } = useStaffRoles();
  const { data: members = [] } = useStaffMembers();
  const { data: allPeriods = [], isLoading } = useShiftPeriods();
  const dashSiteId = useSiteContext().selectedSiteId;
  const { data: sites = [] } = useQuery({
    queryKey: ["staffing-sites", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sites")
        .select("id,name")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const multiSite = sites.length > 1;
  const siteName = (id: string | null) =>
    id ? (sites.find((x) => x.id === id)?.name ?? L.location) : L.allLocations;
  const [siteFilter, setSiteFilter] = useState<string>(dashSiteId ?? NONE);
  const [newSite, setNewSite] = useState<string>(dashSiteId ?? NONE);
  useEffect(() => {
    setSiteFilter(dashSiteId ?? NONE);
    setNewSite(dashSiteId ?? NONE);
  }, [dashSiteId]);
  const periods = useMemo(
    () =>
      siteFilter === NONE
        ? allPeriods
        : allPeriods.filter((p) => periodInSiteScope(siteFilter, p.site_id)),
    [allPeriods, siteFilter],
  );
  const { settings } = useStaffingSettings();
  const [periodId, setPeriodId] = useState<string | null>(null);
  const [newStart, setNewStart] = useState(() =>
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
  );
  const [newWeeks, setNewWeeks] = useState("3");
  const [staffOpen, setStaffOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mode, setMode] = useState<"planned" | "actual">("planned");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState(NONE);
  const [onlyMember, setOnlyMember] = useState(NONE);

  useEffect(() => {
    if (periodId && periods.some((p) => p.id === periodId)) return;
    setPeriodId(periods[0]?.id ?? null);
  }, [periods, periodId]);
  useEffect(() => {
    if (proLocked) setMode("planned");
  }, [proLocked]);
  const period = periods.find((p) => p.id === periodId) ?? null;
  const [payFrom, setPayFrom] = useState("");
  const [payTo, setPayTo] = useState("");
  useEffect(() => {
    if (!period) return;
    const s = parseISO(`${period.start_date}T00:00:00`);
    setPayFrom(period.start_date);
    setPayTo(format(addDays(s, period.weeks * 7 - 1), "yyyy-MM-dd"));
  }, [period]);
  const { data } = usePeriodData(period?.id ?? null);
  const m = useShiftMutations(period?.id ?? null);
  const err = (e: unknown) => {
    const msg = (e as Error)?.message ?? "";
    toast.error(
      msg.includes("TIER_LIMIT") ? L.tierLimit : `${L.error}: ${msg}`,
    );
  };

  const days = useMemo(() => {
    if (!period) return [] as string[];
    const s = parseISO(`${period.start_date}T00:00:00`);
    return Array.from({ length: period.weeks * 7 }, (_, i) =>
      format(addDays(s, i), "yyyy-MM-dd"),
    );
  }, [period]);
  const roleMap = useMemo(() => new Map(roles.map((r) => [r.key, r])), [roles]);
  const memberMap = useMemo(
    () => new Map(members.map((x) => [x.id, x])),
    [members],
  );
  const shiftIndex = useMemo(
    () =>
      new Map((data?.shifts ?? []).map((s) => [`${s.slot_id}|${s.date}`, s])),
    [data],
  );
  const visible = useMemo(
    () =>
      filterShiftSlots(
        data?.slots ?? [],
        {
          query: search,
          roleKey: roleFilter === NONE ? null : roleFilter,
          memberId: onlyMember === NONE ? null : onlyMember,
        },
        (id) => memberMap.get(id)?.name,
        (k) => roleName(roleMap.get(k), lang),
      ),
    [data, search, roleFilter, onlyMember, memberMap, roleMap, lang],
  );

  const createPeriod = () => {
    const weeks = Number(newWeeks);
    m.createPeriod.mutate(
      {
        start_date: newStart,
        weeks,
        roles: roles.map((r) => r.key),
        site_id: newSite === NONE ? null : newSite,
      },
      { onSuccess: (p) => setPeriodId(p.id), onError: err },
    );
  };

  const commitPlanned = (slotId: string, date: string, raw: string) => {
    const p = parseShiftInput(raw);
    if (!p.ok) {
      toast.error(L.badCell);
      return false;
    }
    m.setShift.mutate(
      {
        slot_id: slotId,
        date,
        existing: shiftIndex.get(`${slotId}|${date}`),
        value: p.value,
      },
      { onError: err },
    );
    return true;
  };
  const commitActual = (slotId: string, date: string, raw: string) => {
    const existing = shiftIndex.get(`${slotId}|${date}`);
    if (!existing) return false;
    const p = parseShiftInput(raw);
    if (!p.ok || p.value?.code) {
      toast.error(L.badActual);
      return false;
    }
    m.setActual.mutate(
      {
        existing,
        start: p.value?.start_time ?? null,
        end: p.value?.end_time ?? null,
      },
      { onError: err },
    );
    return true;
  };

  const workerName = (id: string | null) =>
    id ? (memberMap.get(id)?.name ?? "") : "";
  const fileBase = `${tenant?.slug ?? "shifts"}_${period?.start_date ?? ""}`;

  const exportCsv = () => {
    if (!period || !data) return;
    const head = [
      L.role,
      L.worker,
      ...days,
      L.totalHours,
      L.xz,
      L.sunday,
      L.evening,
      L.night,
      L.holiday,
      L.notes,
    ];
    const rows = visible.map((s) => {
      const cells = days.map((d) =>
        (mode === "actual" ? toActualCell : toCell)(
          shiftIndex.get(`${s.id}|${d}`),
        ),
      );
      const t = computeRowTotals(
        days.map((d, i) => ({ date: d, cell: cells[i] })),
        settings.rules,
      );
      return [
        roleName(roleMap.get(s.role_key ?? ""), lang),
        workerName(s.staff_member_id),
        ...cells.map(formatShiftCell),
        t.hours,
        t.xzDays,
        t.sundayHours,
        t.eveningHours,
        t.nightHours,
        t.holidayDays,
        s.notes ?? "",
      ];
    });
    download(toCsv([head, ...rows]), `${fileBase}_shifts`);
  };

  const payroll = async () => {
    if (!tenantId || !payFrom || !payTo) return;
    if (payFrom > payTo) {
      toast.error(L.payRangeInvalid);
      return;
    }
    try {
      const groups = await fetchPayrollRange(
        tenantId,
        payFrom,
        payTo,
        siteFilter === NONE ? null : siteFilter,
      );
      const { days: rows, summary } = buildPayroll(
        groups.map((g) => ({
          worker: workerName(g.staff_member_id),
          role: roleName(roleMap.get(g.role_key ?? ""), lang),
          shifts: g.shifts,
        })),
        settings.rules,
      );
      const { buildPayrollWorkbook, XLSX_MIME } =
        await import("@/lib/staffing/shiftPayrollXlsx");
      const buf = await buildPayrollWorkbook(rows, summary, lang);
      const url = URL.createObjectURL(new Blob([buf], { type: XLSX_MIME }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sanitizePathSegment(`${tenant?.slug ?? "shifts"}_payroll_${payFrom}_${payTo}`)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(L.payrollError);
    }
  };

  const workerSheet = async (memberId: string) => {
    if (!data) return;
    const { createWorkerShiftPdf } =
      await import("@/lib/staffing/workerShiftPdf");
    const lines = data.slots
      .filter((s) => s.staff_member_id === memberId)
      .flatMap((s) =>
        days.map((d) => {
          const x = shiftIndex.get(`${s.id}|${d}`);
          return {
            date: d,
            start: x?.start_time?.slice(0, 5) ?? "",
            end: x?.end_time?.slice(0, 5) ?? "",
            role: roleName(roleMap.get(s.role_key ?? ""), lang),
            note: s.notes ?? "",
          };
        }),
      );
    const name = memberMap.get(memberId)?.name ?? "";
    createWorkerShiftPdf(name, lines, lang).save(
      `${sanitizePathSegment(`${name}_${period?.start_date ?? ""}`)}.pdf`,
    );
  };

  const lookups = {
    member: (id: string) => memberMap.get(id)?.name,
    role: (k: string) => roleName(roleMap.get(k), lang),
    slotLabel: (id: string) => {
      const s = data?.slots.find((x) => x.id === id);
      return s
        ? [
            roleName(roleMap.get(s.role_key ?? ""), lang),
            workerName(s.staff_member_id),
          ]
            .filter(Boolean)
            .join(", ")
        : undefined;
    },
  };

  return (
    <div className="space-y-3">
      <style>{`@media print { @page { size: A3 landscape; margin: 8mm; } body * { visibility: hidden; } #shift-print, #shift-print * { visibility: visible; } #shift-print { position: absolute; left: 0; top: 0; width: 100%; } .no-print { display: none !important; } }`}</style>

      <div className="no-print flex flex-wrap items-end gap-2">
        {multiSite && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">{L.location}</span>
            <Select value={siteFilter} onValueChange={setSiteFilter}>
              <SelectTrigger className="w-48" aria-label={L.location}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{L.allLocations}</SelectItem>
                {sites.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">{L.period}</span>
          <Select
            value={periodId ?? NONE}
            onValueChange={(v) => setPeriodId(v === NONE ? null : v)}
          >
            <SelectTrigger className="w-56" aria-label={L.period}>
              <SelectValue placeholder={L.noPeriods} />
            </SelectTrigger>
            <SelectContent>
              {periods.length === 0 && (
                <SelectItem value={NONE} disabled>
                  {L.noPeriods}
                </SelectItem>
              )}
              {periods.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {format(parseISO(p.start_date), "d.M.yyyy")} ({p.weeks}{" "}
                  {lang === "fi" ? "vk" : lang === "sv" ? "v" : "wk"})
                  {multiSite && ` · ${siteName(p.site_id)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isAdmin && (
          <>
            <div className="space-y-1">
              <label
                htmlFor="shift-new-start"
                className="text-xs text-muted-foreground"
              >
                {L.newStart}
              </label>
              <Input
                id="shift-new-start"
                type="date"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">{L.length}</span>
              <Select value={newWeeks} onValueChange={setNewWeeks}>
                <SelectTrigger className="w-44" aria-label={L.length}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">{L.len3w}</SelectItem>
                  <SelectItem value="5">{L.len1m}</SelectItem>
                  <SelectItem value="13">{L.len3m}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {multiSite && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">
                  {L.newLocation}
                </span>
                <Select value={newSite} onValueChange={setNewSite}>
                  <SelectTrigger className="w-48" aria-label={L.newLocation}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{L.allLocations}</SelectItem>
                    {sites.map((x) => (
                      <SelectItem key={x.id} value={x.id}>
                        {x.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {multiSite && period && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">
                  {L.listLocation}
                </span>
                <Select
                  value={period.site_id ?? NONE}
                  onValueChange={(v) =>
                    m.setPeriodSite.mutate(
                      { id: period.id, site_id: v === NONE ? null : v },
                      { onError: err },
                    )
                  }
                >
                  <SelectTrigger className="w-48" aria-label={L.listLocation}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{L.allLocations}</SelectItem>
                    {sites.map((x) => (
                      <SelectItem key={x.id} value={x.id}>
                        {x.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={createPeriod} disabled={m.createPeriod.isPending}>
              <Plus className="mr-1 h-4 w-4" />
              {L.newPeriod}
            </Button>
            <Button variant="outline" onClick={() => setStaffOpen(true)}>
              <Users className="mr-1 h-4 w-4" />
              {L.staffRegister}
            </Button>
            <Button variant="outline" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="mr-1 h-4 w-4" />
              {L.settings}
            </Button>
          </>
        )}
      </div>

      {!isAdmin && (
        <p className="no-print text-xs text-muted-foreground">{L.viewOnly}</p>
      )}

      {period && (
        <div className="no-print flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={mode === "planned" ? "default" : "outline"}
            onClick={() => setMode("planned")}
          >
            {L.modePlanned}
          </Button>
          <Button
            size="sm"
            variant={mode === "actual" ? "default" : "outline"}
            onClick={() => setMode("actual")}
            disabled={proLocked}
            title={proLocked ? L.upgradeActual : undefined}
          >
            {L.modeActual}
          </Button>
          <span className="mx-1 h-5 w-px bg-border" />
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" />
            {L.print}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={exportCsv}
            disabled={proLocked}
            title={proLocked ? L.upgradeActual : undefined}
          >
            <FileSpreadsheet className="mr-1 h-4 w-4" />
            {L.exportCsv}
          </Button>
          {isAdmin && (
            <>
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                {L.payFrom}
                <Input
                  type="date"
                  value={payFrom}
                  onChange={(e) => setPayFrom(e.target.value)}
                  disabled={bizLocked}
                  className="h-8 w-36"
                  aria-label={L.payFrom}
                />
              </label>
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                {L.payTo}
                <Input
                  type="date"
                  value={payTo}
                  onChange={(e) => setPayTo(e.target.value)}
                  disabled={bizLocked}
                  className="h-8 w-36"
                  aria-label={L.payTo}
                />
              </label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void payroll()}
                disabled={bizLocked}
                title={bizLocked ? L.upgradePayroll : undefined}
              >
                <FileSpreadsheet className="mr-1 h-4 w-4" />
                {L.payrollExcel}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setHistoryOpen(true)}
                disabled={bizLocked}
                title={bizLocked ? L.upgradePayroll : undefined}
              >
                <History className="mr-1 h-4 w-4" />
                {L.history}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  window.confirm(L.confirmDeletePeriod) &&
                  m.deletePeriod.mutate(period.id, {
                    onSuccess: () => setPeriodId(null),
                    onError: err,
                  })
                }
              >
                <Trash2 className="mr-1 h-4 w-4" />
                {L.deletePeriod}
              </Button>
            </>
          )}
        </div>
      )}

      {period && (
        <div className="no-print flex flex-wrap items-center gap-2">
          <Input
            aria-label={L.search}
            placeholder={L.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-44" aria-label={L.role}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{L.allRoles}</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r.key} value={r.key}>
                  {roleName(r, lang)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={onlyMember} onValueChange={setOnlyMember}>
            <SelectTrigger className="w-44" aria-label={L.worker}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{L.allWorkers}</SelectItem>
              {members.map((x) => (
                <SelectItem key={x.id} value={x.id}>
                  {x.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {period && (
        <p className="no-print text-xs text-muted-foreground">
          {mode === "planned" ? L.help : L.helpActual}
        </p>
      )}

      {isLoading && <Skeleton className="h-40 w-full" />}
      {!isLoading && !period && (
        <p className="text-sm text-muted-foreground">{L.noPeriods}</p>
      )}

      {period && data && (
        <div id="shift-print">
          <h2 className="mb-2 hidden text-lg font-semibold print:block">
            {tenant?.name}: {L.period}{" "}
            {format(parseISO(period.start_date), "d.M.yyyy")}
          </h2>
          <div
            className="max-h-[70vh] overflow-auto border border-border print:max-h-none print:overflow-visible print:border-0"
            data-testid="shift-table-scroll"
          >
            <table className="border-collapse text-[11px]">
              <thead className="sticky top-0 z-10 bg-card print:static">
                <tr>
                  <th
                    data-shift-pinned
                    className="sticky left-0 z-20 w-36 min-w-36 border border-border bg-card px-1 py-1 text-left print:static"
                  >
                    {L.role}
                  </th>
                  <th
                    data-shift-pinned
                    className="sticky left-36 z-20 w-36 min-w-36 border border-border bg-card px-1 py-1 text-left print:static"
                  >
                    {L.worker}
                  </th>
                  {days.map((d) => (
                    <th
                      key={d}
                      className={`border border-border px-1 py-1 font-normal ${isSundayWorkDay(d, settings.rules.finnishHolidays !== false) ? "bg-muted" : ""}`}
                    >
                      {format(parseISO(d), "EEEEE")}
                      <br />
                      {format(parseISO(d), "d.M")}
                    </th>
                  ))}
                  {[
                    L.totalHours,
                    L.xz,
                    L.sunday,
                    L.evening,
                    L.night,
                    L.holiday,
                    L.notes,
                  ].map((h) => (
                    <th key={h} className="border border-border px-1 py-1">
                      {h}
                    </th>
                  ))}
                  <th className="no-print border border-border" />
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={days.length + 10} className="p-6 text-center">
                      <SearchX className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
                      <p className="font-medium">{L.noMatch}</p>
                      <p className="text-muted-foreground">{L.noMatchBody}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          setSearch("");
                          setRoleFilter(NONE);
                          setOnlyMember(NONE);
                        }}
                      >
                        <RotateCcw className="mr-1 h-3.5 w-3.5" />
                        {L.clearFilters}
                      </Button>
                    </td>
                  </tr>
                )}
                {visible.map((s) => {
                  const cells = days.map((d) => shiftIndex.get(`${s.id}|${d}`));
                  const basis = cells.map(
                    mode === "actual" ? toActualCell : toCell,
                  );
                  const t = computeRowTotals(
                    days.map((d, i) => ({ date: d, cell: basis[i] })),
                    settings.rules,
                  );
                  const eligible = members.filter(
                    (x) =>
                      x.is_active &&
                      (!s.role_key || x.role_keys.includes(s.role_key)),
                  );
                  const current = s.staff_member_id
                    ? memberMap.get(s.staff_member_id)
                    : undefined;
                  return (
                    <tr key={s.id}>
                      <td className="sticky left-0 z-[5] border border-border bg-card p-0 print:static">
                        <select
                          disabled={!isAdmin}
                          aria-label={L.role}
                          value={s.role_key ?? ""}
                          onChange={(e) =>
                            m.updateSlot.mutate(
                              { id: s.id, role_key: e.target.value || null },
                              { onError: err },
                            )
                          }
                          className="w-full bg-transparent px-1 py-1 text-[11px]"
                        >
                          <option value="">{L.noRole}</option>
                          {roles.map((r) => (
                            <option key={r.key} value={r.key}>
                              {roleName(r, lang)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="sticky left-36 z-[5] border border-border bg-card p-0 print:static">
                        <select
                          disabled={!isAdmin}
                          aria-label={L.worker}
                          value={s.staff_member_id ?? ""}
                          onChange={(e) =>
                            m.updateSlot.mutate(
                              {
                                id: s.id,
                                staff_member_id: e.target.value || null,
                              },
                              { onError: err },
                            )
                          }
                          className="w-full bg-transparent px-1 py-1 text-[11px]"
                        >
                          <option value="">{L.vacant}</option>
                          {current && !eligible.includes(current) && (
                            <option value={current.id}>{current.name}</option>
                          )}
                          {eligible.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      {days.map((d, i) => (
                        <td
                          key={d}
                          className={`border border-border p-0 ${isSundayWorkDay(d, settings.rules.finnishHolidays !== false) ? "bg-muted/60" : ""}`}
                        >
                          {mode === "planned" ? (
                            <CellInput
                              label={`${current?.name ?? L.vacant} ${d}`}
                              disabled={!isAdmin}
                              value={formatShiftCell(toCell(cells[i]))}
                              onCommit={(v) => commitPlanned(s.id, d, v)}
                            />
                          ) : (
                            <CellInput
                              label={`${current?.name ?? L.vacant} ${d}`}
                              disabled={!cells[i] || !!cells[i]?.code}
                              value={formatShiftCell(
                                cells[i]?.actual_start_time
                                  ? toActualCell(cells[i])
                                  : null,
                              )}
                              placeholder={formatShiftCell(toCell(cells[i]))}
                              onCommit={(v) => commitActual(s.id, d, v)}
                            />
                          )}
                        </td>
                      ))}
                      <td className="border border-border px-1 text-center font-medium">
                        {t.hours || ""}
                      </td>
                      <td className="border border-border px-1 text-center">
                        {t.xzDays || ""}
                      </td>
                      <td className="border border-border px-1 text-center">
                        {t.sundayHours || ""}
                      </td>
                      <td className="border border-border px-1 text-center">
                        {t.eveningHours || ""}
                      </td>
                      <td className="border border-border px-1 text-center">
                        {t.nightHours || ""}
                      </td>
                      <td className="border border-border px-1 text-center">
                        {t.holidayDays || ""}
                      </td>
                      <td className="border border-border p-0">
                        <CellInput
                          label={L.notes}
                          disabled={!isAdmin}
                          value={s.notes ?? ""}
                          onCommit={(v) => {
                            m.updateSlot.mutate(
                              { id: s.id, notes: v.slice(0, 200) || null },
                              { onError: err },
                            );
                            return true;
                          }}
                        />
                      </td>
                      <td className="no-print whitespace-nowrap border border-border px-1">
                        <button
                          className="mr-1"
                          aria-label={
                            current
                              ? `${L.perWorker}: ${current.name}`
                              : L.perWorker
                          }
                          disabled={!current}
                          onClick={() => current && workerSheet(current.id)}
                        >
                          <FileDown className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        {isAdmin && (
                          <button
                            aria-label={L.removeRow}
                            onClick={() =>
                              m.deleteSlot.mutate(s.id, { onError: err })
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{L.legend}</p>
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              className="no-print mt-2"
              onClick={() =>
                m.addSlot.mutate(
                  { period_id: period.id, slot_order: data.slots.length },
                  { onError: err },
                )
              }
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {L.addRow}
            </Button>
          )}
        </div>
      )}

      <StaffRegisterDialog
        open={staffOpen}
        onOpenChange={setStaffOpen}
        lang={lang}
        roles={roles}
        members={members}
      />
      <StaffingSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        lang={lang}
      />
      <ShiftHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        lang={lang}
        periodId={period?.id ?? null}
        lookups={lookups}
      />
    </div>
  );
}
