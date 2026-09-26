import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useTierErrorMessage } from "@/hooks/useTierErrorMessage";
import {
  useShiftMutations,
  useShiftPeriods,
  useStaffMembers,
  useStaffRoles,
} from "@/hooks/useShiftList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { STAFF_LABELS, type StaffLang } from "@/lib/staffing/labels";
import StaffRegisterDialog, { StaffSiteSelect } from "./StaffRegisterDialog";

const siteSlug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "location";

function Step({
  n,
  done,
  optional,
  title,
  hint,
  children,
  doneLabel,
  optionalLabel,
}: {
  n: number;
  done: boolean;
  optional?: boolean;
  title: string;
  hint: string;
  children?: ReactNode;
  doneLabel: string;
  optionalLabel: string;
}) {
  return (
    <li className="flex gap-3 border-t border-border pt-3 first:border-0 first:pt-0">
      {done ? (
        <CheckCircle2
          className="mt-0.5 h-5 w-5 shrink-0 text-primary"
          aria-hidden
        />
      ) : (
        <Circle
          className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
          aria-hidden
        />
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">
            {n}. {title}
          </h3>
          {done ? (
            <Badge variant="secondary">{doneLabel}</Badge>
          ) : optional ? (
            <Badge variant="outline">{optionalLabel}</Badge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{hint}</p>
        {children}
      </div>
    </li>
  );
}

/**
 * Owner/admin setup flow on the Staffing page: locations, roles and staff,
 * staff-to-location assignment, then the first shift list. Hidden per tenant
 * once dismissed; reopened with the "Setup guide" button.
 */
export default function StaffingSetupGuide({
  lang,
  onGoToShifts,
}: {
  lang: StaffLang;
  onGoToShifts: () => void;
}) {
  const L = STAFF_LABELS[lang];
  const { tenantId, isAdmin } = useTenant();
  const qc = useQueryClient();
  const tierError = useTierErrorMessage();
  const m = useShiftMutations(null);
  const { data: roles = [] } = useStaffRoles();
  const { data: members = [] } = useStaffMembers();
  const { data: periods = [] } = useShiftPeriods();
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

  const storageKey = `mimmobook-staffing-setup-hidden:${tenantId}`;
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    if (tenantId) setHidden(localStorage.getItem(storageKey) === "1");
  }, [tenantId, storageKey]);
  const setHide = (v: boolean) => {
    setHidden(v);
    if (v) localStorage.setItem(storageKey, "1");
    else localStorage.removeItem(storageKey);
  };

  const [siteName, setSiteName] = useState("");
  const [staffOpen, setStaffOpen] = useState(false);

  const addSite = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("sites")
        .insert({
          tenant_id: tenantId!,
          name,
          slug: `${siteSlug(name)}-${Math.random().toString(36).slice(2, 6)}`,
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: copyErr } = await supabase.rpc(
        "copy_tenant_defaults_to_site",
        { p_tenant_id: tenantId!, p_site_id: data.id },
      );
      if (copyErr) console.error("Failed to copy defaults:", copyErr);
    },
    onSuccess: () => {
      setSiteName("");
      qc.invalidateQueries({ queryKey: ["staffing-sites", tenantId] });
      qc.invalidateQueries({ queryKey: ["sites", tenantId] });
      qc.invalidateQueries({ queryKey: ["sites-selector", tenantId] });
      toast.success(L.setupLocationAdded);
    },
    onError: (e: any) =>
      toast.error(tierError(e)?.message ?? `${L.error}: ${e?.message ?? ""}`),
  });

  if (!isAdmin) return null;

  const active = members.filter((x) => x.is_active);
  const multiSite = sites.length > 1;
  const step1 = sites.length > 0;
  const step2 = roles.length > 0 && active.length > 0;
  const step3 = step2 && (!multiSite || active.some((x) => x.site_id));
  const step4 = periods.length > 0;
  const allDone = step1 && step2 && step4;

  if (hidden)
    return (
      <div className="no-print flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setHide(false)}>
          <ListChecks className="mr-1 h-4 w-4" />
          {L.setupShow}
        </Button>
      </div>
    );

  return (
    <section
      aria-labelledby="staffing-setup-title"
      className="no-print space-y-3 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="staffing-setup-title" className="font-semibold">
            {L.setupTitle}
          </h2>
          <p className="text-sm text-muted-foreground">
            {allDone ? L.setupAllDone : L.setupIntro}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setHide(true)}>
          {L.setupHide}
        </Button>
      </div>
      <ol className="space-y-3">
        <Step
          doneLabel={L.setupDone}
          optionalLabel={L.setupOptional}

          n={1}
          done={step1}
          title={L.setupStep1}
          hint={L.setupStep1Hint}
        >
          {sites.length > 0 && (
            <p className="text-xs">{sites.map((s) => s.name).join(", ")}</p>
          )}
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const n = siteName.trim();
              if (n) addSite.mutate(n);
            }}
          >
            <Input
              aria-label={L.setupLocationName}
              placeholder={L.setupLocationName}
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              maxLength={100}
              className="w-56"
            />
            <Button
              type="submit"
              variant="outline"
              disabled={!siteName.trim() || addSite.isPending}
            >
              {L.setupAddLocation}
            </Button>
          </form>
        </Step>

        <Step
          doneLabel={L.setupDone}
          optionalLabel={L.setupOptional}

          n={2}
          done={step2}
          title={L.setupStep2}
          hint={L.setupStep2Hint}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs">
              {L.setupCounts
                .replace("{roles}", String(roles.length))
                .replace("{staff}", String(active.length))}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStaffOpen(true)}
            >
              {L.setupOpenStaff}
            </Button>
          </div>
        </Step>

        <Step
          doneLabel={L.setupDone}
          optionalLabel={L.setupOptional}
          n={3}
          done={step3}
          optional={!step3}
          title={L.setupStep3}
          hint={L.setupStep3Hint}
        >
          {!multiSite ? (
            <p className="text-xs text-muted-foreground">{L.setupSingleSite}</p>
          ) : active.length === 0 ? (
            <p className="text-xs text-muted-foreground">{L.setupNoStaffYet}</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {active.map((x) => (
                <li
                  key={x.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate">{x.name}</span>
                  <StaffSiteSelect
                    member={x}
                    sites={sites}
                    label={`${L.staffLocation}: ${x.name}`}
                    allLabel={L.allLocations}
                    onChange={(v) =>
                      m.saveMember.mutate(
                        { id: x.id, name: x.name, site_ids: v },
                        {
                          onError: (e) =>
                            toast.error(
                              `${L.error}: ${(e as Error)?.message ?? ""}`,
                            ),
                        },
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </Step>

        <Step
          doneLabel={L.setupDone}
          optionalLabel={L.setupOptional}

          n={4}
          done={step4}
          title={L.setupStep4}
          hint={L.setupStep4Hint}
        >
          <Button
            size="sm"
            disabled={!step2}
            onClick={() => {
              onGoToShifts();
              setTimeout(
                () => document.getElementById("staffing-new-list")?.focus(),
                50,
              );
            }}
          >
            {L.setupGoShifts}
          </Button>
        </Step>
      </ol>

      <StaffRegisterDialog
        open={staffOpen}
        onOpenChange={setStaffOpen}
        lang={lang}
        roles={roles}
        members={members}
        sites={sites}
      />
    </section>
  );
}
