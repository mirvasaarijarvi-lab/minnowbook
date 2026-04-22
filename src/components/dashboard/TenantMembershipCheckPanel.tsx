import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, AlertTriangle, RefreshCw, Database, Users, ShieldAlert } from "lucide-react";

interface HealthRow {
  total_memberships: number;
  unique_users: number;
  users_with_multiple_tenants: number;
  users_with_no_resolvable_tenant: number;
}

interface DuplicateRow {
  user_id: string;
  tenant_count: number;
  tenant_ids: string[];
  tenant_names: string[] | null;
  resolved_tenant_id: string | null;
}

/**
 * Superadmin-only diagnostic panel that verifies the multi-tenant integrity
 * invariants put in place by the recent RLS hardening:
 *
 *  - Every user belongs to at most one tenant (UNIQUE constraint on tenant_users).
 *  - get_user_tenant_id(user_id) returns NULL when the constraint is somehow
 *    bypassed and a user ends up linked to multiple tenants. This is the
 *    fail-closed behaviour that keeps RLS safe even on legacy data.
 */
const TenantMembershipCheckPanel = () => {
  const healthQuery = useQuery({
    queryKey: ["tenant-membership-health"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_tenant_membership_health");
      if (error) throw error;
      return (data?.[0] ?? null) as HealthRow | null;
    },
  });

  const duplicatesQuery = useQuery({
    queryKey: ["users-with-multiple-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("find_users_with_multiple_tenants");
      if (error) throw error;
      return (data ?? []) as DuplicateRow[];
    },
  });

  const isLoading = healthQuery.isLoading || duplicatesQuery.isLoading;
  const isError = healthQuery.isError || duplicatesQuery.isError;
  const errorMessage =
    (healthQuery.error as Error | null)?.message ?? (duplicatesQuery.error as Error | null)?.message;

  const health = healthQuery.data;
  const duplicates = duplicatesQuery.data ?? [];

  // Cross-check: get_user_tenant_id MUST return NULL for any user with > 1 tenant
  const resolverFailures = duplicates.filter((d) => d.resolved_tenant_id !== null);
  const resolverContractHolds = resolverFailures.length === 0;
  const integrityHolds = (health?.users_with_multiple_tenants ?? 0) === 0;

  const refresh = () => {
    healthQuery.refetch();
    duplicatesQuery.refetch();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-xl font-serif flex items-center gap-2">
            <Database className="h-5 w-5 text-accent" />
            Tenant Membership Integrity Check
          </CardTitle>
          <CardDescription>
            Verifies no user is linked to multiple tenants and that{" "}
            <code className="text-xs font-mono">get_user_tenant_id()</code> returns NULL when duplicates exist.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Re-run
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isError && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Check failed</AlertTitle>
            <AlertDescription>{errorMessage ?? "Unable to run integrity check."}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatTile
                label="Total memberships"
                value={health?.total_memberships ?? 0}
                icon={<Users className="h-4 w-4 text-muted-foreground" />}
              />
              <StatTile
                label="Unique users"
                value={health?.unique_users ?? 0}
                icon={<Users className="h-4 w-4 text-muted-foreground" />}
              />
              <StatTile
                label="Users with > 1 tenant"
                value={health?.users_with_multiple_tenants ?? 0}
                tone={health?.users_with_multiple_tenants ? "danger" : "ok"}
              />
              <StatTile
                label="Unresolvable users"
                value={health?.users_with_no_resolvable_tenant ?? 0}
                tone={health?.users_with_no_resolvable_tenant ? "warning" : "ok"}
              />
            </div>

            {/* Verdicts */}
            <div className="grid sm:grid-cols-2 gap-3">
              <VerdictCard
                ok={integrityHolds}
                title="Uniqueness invariant"
                okText="Every user belongs to exactly one tenant."
                failText={`Found ${health?.users_with_multiple_tenants ?? 0} user(s) linked to multiple tenants.`}
              />
              <VerdictCard
                ok={resolverContractHolds}
                title="get_user_tenant_id contract"
                okText="Returns NULL for any user with duplicate memberships (fail-closed)."
                failText={`Resolver returned a non-null tenant for ${resolverFailures.length} ambiguous user(s) — RLS may leak.`}
              />
            </div>

            {/* Duplicates table */}
            {duplicates.length > 0 && (
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-mono text-xs">User ID</TableHead>
                      <TableHead>Tenants</TableHead>
                      <TableHead className="text-center">Count</TableHead>
                      <TableHead>Resolver result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {duplicates.map((row) => (
                      <TableRow key={row.user_id}>
                        <TableCell className="font-mono text-xs break-all max-w-[200px]">
                          {row.user_id}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(row.tenant_names ?? []).map((name, idx) => (
                              <Badge key={`${row.user_id}-${idx}`} variant="outline" className="text-xs">
                                {name ?? "Unknown"}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="destructive">{row.tenant_count}</Badge>
                        </TableCell>
                        <TableCell>
                          {row.resolved_tenant_id === null ? (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              NULL (safe)
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1 font-mono text-[10px]">
                              <AlertTriangle className="h-3 w-3" />
                              {row.resolved_tenant_id.slice(0, 8)}…
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {duplicates.length === 0 && integrityHolds && (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <AlertTitle>All checks passed</AlertTitle>
                <AlertDescription>
                  No tenant_users duplicates found. The UNIQUE (user_id) constraint and the
                  get_user_tenant_id() resolver are both behaving correctly.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

const StatTile = ({
  label,
  value,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "ok" | "warning" | "danger";
  icon?: React.ReactNode;
}) => {
  const toneClass =
    tone === "danger"
      ? "border-destructive/40 bg-destructive/5"
      : tone === "warning"
        ? "border-accent/40 bg-accent/5"
        : tone === "ok" && value === 0
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-muted/30";
  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
        <span>{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-serif font-semibold text-foreground">{value}</div>
    </div>
  );
};

const VerdictCard = ({
  ok,
  title,
  okText,
  failText,
}: {
  ok: boolean;
  title: string;
  okText: string;
  failText: string;
}) => (
  <div
    className={`rounded-md border p-3 flex items-start gap-3 ${
      ok ? "border-primary/30 bg-primary/5" : "border-destructive/40 bg-destructive/5"
    }`}
  >
    {ok ? (
      <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
    ) : (
      <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
    )}
    <div className="space-y-0.5 min-w-0">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{ok ? okText : failText}</p>
    </div>
  </div>
);

export default TenantMembershipCheckPanel;
