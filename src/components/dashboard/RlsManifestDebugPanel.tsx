import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import {
  FileCode2,
  Copy,
  RefreshCw,
  Database,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

/**
 * RLS Manifest Debug Panel
 *
 * Surfaces the exact SQL/filters used by the cross-tenant manifest integrity
 * checks (see src/test/security/tenant-table-manifest.test.ts). Lets a system
 * admin inspect live results and copy the full debug payload as JSON for
 * sharing in a ticket or pasting into the test suite.
 */

// Mirrors COVERED_TABLES in tenant-table-manifest.test.ts.
const COVERED_TABLES = new Set<string>([
  "access_code_redemptions",
  "archived_reservations",
  "audit_log",
  "beta_feedback",
  "blocked_slots",
  "booking_tokens",
  "booking_validation_log",
  "discount_codes",
  "email_send_log",
  "guest_reviews",
  "kitchen_menu_items",
  "kitchen_orders",
  "login_history",
  "notifications",
  "offers",
  "recurring_blocked_slots",
  "reservations",
  "resource_images",
  "resource_opening_hours",
  "resources",
  "role_definitions",
  "role_permissions",
  "site_settings",
  "site_users",
  "sites",
  "support_requests",
  "tenant_email_templates",
  "tenant_opening_hours",
  "tenant_settings",
  "tenant_users",
]);

// Mirrors EXCLUDED_TABLES in tenant-table-manifest.test.ts.
const EXCLUDED_TABLES: Record<string, string> = {
  waitlist:
    "Public marketing signup table — no tenant-private data; intentionally readable by service role only.",
};

// The exact SQL the SECURITY DEFINER RPC runs server-side. Shown verbatim so
// admins can replicate it locally if needed.
const RPC_SQL = `-- public.list_tenant_scoped_tables()
SELECT c.table_name::text
FROM information_schema.columns c
JOIN pg_class pc ON pc.relname = c.table_name
WHERE c.table_schema = 'public'
  AND c.column_name = 'tenant_id'
  AND pc.relkind = 'r' -- base tables only (excludes views)
ORDER BY c.table_name;`;

const RPC_INVOCATION = `-- Client invocation
SELECT * FROM public.list_tenant_scoped_tables();`;

interface ManifestDebugReport {
  generated_at: string;
  rpc: {
    name: string;
    sql: string;
    invocation: string;
  };
  manifest: {
    covered_tables: string[];
    excluded_tables: Record<string, string>;
  };
  live_schema: {
    tables: string[];
    count: number;
    error: string | null;
  };
  integrity_checks: {
    uncovered: string[];
    stale_covered: string[];
    stale_excluded: string[];
    overlap: string[];
  };
  summary: {
    status: "ok" | "warning" | "error";
    message: string;
  };
}

const SectionHeading = ({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) => (
  <div className="flex items-center justify-between gap-2 mb-2">
    <div className="flex items-center gap-2">
      {icon}
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
    </div>
    {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
  </div>
);

const RlsManifestDebugPanel = () => {
  const [showCovered, setShowCovered] = useState(false);

  const {
    data: report,
    isLoading,
    isFetching,
    refetch,
  } = useQuery<ManifestDebugReport>({
    queryKey: ["rls-manifest-debug"],
    queryFn: async () => {
      const generated_at = new Date().toISOString();
      let live: string[] = [];
      let liveError: string | null = null;

      const { data, error } = await supabase.rpc("list_tenant_scoped_tables");
      if (error) {
        liveError = error.message;
      } else {
        live = (data ?? []).map((row: { table_name: string }) => row.table_name).sort();
      }

      const liveSet = new Set(live);
      const uncovered = live.filter((t) => !COVERED_TABLES.has(t) && !(t in EXCLUDED_TABLES));
      const staleCovered = [...COVERED_TABLES].filter((t) => !liveSet.has(t));
      const staleExcluded = Object.keys(EXCLUDED_TABLES).filter((t) => !liveSet.has(t));
      const overlap = [...COVERED_TABLES].filter((t) => t in EXCLUDED_TABLES);

      const hasErrors =
        !!liveError || uncovered.length > 0 || staleCovered.length > 0 || staleExcluded.length > 0 || overlap.length > 0;

      return {
        generated_at,
        rpc: {
          name: "public.list_tenant_scoped_tables",
          sql: RPC_SQL,
          invocation: RPC_INVOCATION,
        },
        manifest: {
          covered_tables: [...COVERED_TABLES].sort(),
          excluded_tables: EXCLUDED_TABLES,
        },
        live_schema: {
          tables: live,
          count: live.length,
          error: liveError,
        },
        integrity_checks: {
          uncovered,
          stale_covered: staleCovered,
          stale_excluded: staleExcluded,
          overlap,
        },
        summary: {
          status: liveError ? "error" : hasErrors ? "warning" : "ok",
          message: liveError
            ? `RPC failed: ${liveError}`
            : hasErrors
              ? "Manifest is out of sync with the live schema."
              : "All tenant-scoped tables are accounted for.",
        },
      };
    },
    staleTime: 60_000,
  });

  const copyJson = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      toast({ title: "Copied", description: "Debug report copied as JSON." });
    } catch (e: any) {
      toast({ title: "Copy failed", description: e?.message ?? "Clipboard unavailable.", variant: "destructive" });
    }
  };

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: "Copied", description: `${label} copied to clipboard.` });
    } catch (e: any) {
      toast({ title: "Copy failed", description: e?.message ?? "Clipboard unavailable.", variant: "destructive" });
    }
  };

  const status = report?.summary.status ?? "ok";
  const statusBadgeClass =
    status === "ok"
      ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/10"
      : status === "warning"
        ? "border-amber-500/30 text-amber-600 bg-amber-500/10"
        : "border-destructive/30 text-destructive bg-destructive/10";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FileCode2 className="h-5 w-5 text-primary" />
            <CardTitle className="font-serif text-base sm:text-lg">RLS Manifest Debug</CardTitle>
            {report && (
              <Badge variant="outline" className={`text-xs ${statusBadgeClass}`}>
                {status === "ok" ? "In sync" : status === "warning" ? "Out of sync" : "Error"}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={copyJson}
              disabled={!report || isFetching}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy as JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Re-run
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
          <Info className="h-3 w-3" />
          Mirrors <code className="font-mono">tenant-table-manifest.test.ts</code> — the SQL below is what the test suite
          runs against the live schema.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading || !report ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Summary banner */}
            <div
              className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${
                status === "ok"
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                  : status === "warning"
                    ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
                    : "border-destructive/30 bg-destructive/5 text-destructive"
              }`}
            >
              {status === "ok" ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-medium">{report.summary.message}</p>
                <p className="text-xs opacity-80 mt-0.5">
                  Generated {new Date(report.generated_at).toLocaleString()} · {report.live_schema.count} live tenant-scoped
                  table{report.live_schema.count === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            {/* RPC SQL */}
            <div>
              <SectionHeading
                icon={<Database className="h-4 w-4 text-muted-foreground" />}
                title="RPC: list_tenant_scoped_tables()"
                hint="SECURITY DEFINER · returns base-table names only"
              />
              <div className="rounded-md border bg-muted/40 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/60">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">SQL</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 text-xs"
                    onClick={() => copyText("SQL", report.rpc.sql)}
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </Button>
                </div>
                <pre className="text-xs font-mono p-3 overflow-x-auto whitespace-pre">{report.rpc.sql}</pre>
              </div>
              <div className="rounded-md border bg-muted/40 overflow-hidden mt-2">
                <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/60">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">Invocation</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 text-xs"
                    onClick={() => copyText("Invocation", report.rpc.invocation)}
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </Button>
                </div>
                <pre className="text-xs font-mono p-3 overflow-x-auto whitespace-pre">{report.rpc.invocation}</pre>
              </div>
            </div>

            {/* Integrity check filters */}
            <div className="grid sm:grid-cols-2 gap-3">
              <FilterCard
                title="Uncovered tables"
                description="live ∖ COVERED_TABLES ∖ EXCLUDED_TABLES"
                items={report.integrity_checks.uncovered}
                tone={report.integrity_checks.uncovered.length ? "error" : "ok"}
              />
              <FilterCard
                title="Stale in COVERED_TABLES"
                description="COVERED_TABLES ∖ live"
                items={report.integrity_checks.stale_covered}
                tone={report.integrity_checks.stale_covered.length ? "warning" : "ok"}
              />
              <FilterCard
                title="Stale in EXCLUDED_TABLES"
                description="EXCLUDED_TABLES ∖ live"
                items={report.integrity_checks.stale_excluded}
                tone={report.integrity_checks.stale_excluded.length ? "warning" : "ok"}
              />
              <FilterCard
                title="Overlap"
                description="COVERED_TABLES ∩ EXCLUDED_TABLES"
                items={report.integrity_checks.overlap}
                tone={report.integrity_checks.overlap.length ? "error" : "ok"}
              />
            </div>

            {/* Covered list (collapsible) */}
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCovered((v) => !v)}
                className="gap-1.5 -ml-2"
              >
                {showCovered ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {showCovered ? "Hide" : "Show"} live tables ({report.live_schema.count})
              </Button>
              {showCovered && (
                <ScrollArea className="h-48 mt-2 rounded-md border bg-muted/30 p-3">
                  <div className="flex flex-wrap gap-1.5">
                    {report.live_schema.tables.map((t) => {
                      const covered = COVERED_TABLES.has(t);
                      const excluded = t in EXCLUDED_TABLES;
                      return (
                        <Badge
                          key={t}
                          variant="outline"
                          className={`text-[10px] font-mono ${
                            covered
                              ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                              : excluded
                                ? "border-amber-500/30 text-amber-700 dark:text-amber-400"
                                : "border-destructive/30 text-destructive"
                          }`}
                          title={excluded ? EXCLUDED_TABLES[t] : covered ? "covered" : "uncovered"}
                        >
                          {t}
                        </Badge>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

const FilterCard = ({
  title,
  description,
  items,
  tone,
}: {
  title: string;
  description: string;
  items: string[];
  tone: "ok" | "warning" | "error";
}) => {
  const toneClass =
    tone === "ok"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : tone === "warning"
        ? "border-amber-500/30 bg-amber-500/5"
        : "border-destructive/30 bg-destructive/5";

  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <h5 className="text-xs font-semibold text-foreground">{title}</h5>
        <Badge variant="outline" className="text-[10px]">
          {items.length}
        </Badge>
      </div>
      <code className="text-[10px] text-muted-foreground font-mono block mb-2 break-all">{description}</code>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">None — all clear.</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {items.map((t) => (
            <Badge key={t} variant="outline" className="text-[10px] font-mono bg-background">
              {t}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export default RlsManifestDebugPanel;
