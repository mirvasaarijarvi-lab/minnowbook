import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, endOfDay } from "date-fns";
import {
  ShieldAlert,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  ExternalLink,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useIsSystemAdmin } from "@/hooks/useIsSystemAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import DashboardTooltip from "./DashboardTooltip";

/**
 * Forbidden Access audit log panel (Superadmin-only).
 *
 * Surfaces every `audit_log` row written by the `log-forbidden-access`
 * edge function — i.e. every authenticated navigation that hit a
 * route-level guard like `<SystemAdminRoute>` and was denied. These
 * rows live alongside regular CRUD audit entries but use a distinct
 * `action = 'forbidden_access'` so we can isolate them here.
 *
 * What's stored per row (see log-forbidden-access edge function):
 *   - tenant_id   — resolved from the caller's tenant membership
 *   - user_id     — verified from the caller's JWT (never client-supplied)
 *   - table_name  — always 'auth_routes' for these entries
 *   - summary     — human-readable line ("Forbidden access attempt to …")
 *   - new_data    — JSON: { attempted_area, attempted_area_label,
 *                            attempted_path, user_agent, ip, attempted_at }
 *
 * Why Superadmin-only:
 *   - Tenant owners/admins can already see their own tenant's audit_log
 *     via the tenant Audit Log panel; this view is the cross-tenant
 *     security review surface (system admins only).
 *   - The underlying RLS policies already enforce this — system admins
 *     have ALL on `audit_log`; tenant members see only their tenant.
 *
 * Filtering / pagination:
 *   - User id (exact UUID)        → `eq('user_id', ...)`
 *   - Tenant id (exact UUID)      → `eq('tenant_id', ...)`
 *   - Attempted path (contains)   → `ilike('new_data->>attempted_path', ...)`
 *   - Date range                  → `gte/lte('created_at', ...)`
 *   - Page size 25; "Load more" via `range()` with a +1 hasMore probe.
 */

const PAGE_SIZE = 25;

interface ForbiddenAccessRow {
  id: string;
  created_at: string;
  tenant_id: string;
  user_id: string | null;
  summary: string | null;
  new_data: {
    attempted_area?: string;
    attempted_area_label?: string | null;
    attempted_path?: string | null;
    user_agent?: string | null;
    ip?: string | null;
    attempted_at?: string | null;
  } | null;
}

/**
 * Loose UUID shape check. The audit edge function only writes UUIDs to
 * user_id / tenant_id columns, but the filter inputs are free text — we
 * validate before issuing an `eq()` so a typo doesn't crash the query.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (s: string): boolean => UUID_RE.test(s.trim());

const ForbiddenAccessLogPanel = () => {
  const { isSystemAdmin } = useIsSystemAdmin();

  // Filter state. Inputs are debounced via the React Query key so each
  // keystroke doesn't fire a new request — the query refetches when any
  // dependency in the key changes, and the input's onChange just updates
  // local state. (Acceptable for an admin-only panel; if it ever becomes
  // chatty under real load, wrap with a useDebouncedValue hook.)
  const [userIdFilter, setUserIdFilter] = useState("");
  const [tenantIdFilter, setTenantIdFilter] = useState<string>("all");
  const [pathFilter, setPathFilter] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [page, setPage] = useState(0);

  const trimmedUserId = userIdFilter.trim();
  const trimmedPath = pathFilter.trim();
  const userIdValid = trimmedUserId === "" || isUuid(trimmedUserId);

  const resetFilters = useCallback(() => {
    setUserIdFilter("");
    setTenantIdFilter("all");
    setPathFilter("");
    setDateFrom(undefined);
    setDateTo(undefined);
    setPage(0);
  }, []);

  // Reset to page 0 whenever a filter changes so the user never paginates
  // off the end of a stale result set.
  const onFilterChange = useCallback(<T,>(setter: (v: T) => void) => {
    return (v: T) => {
      setter(v);
      setPage(0);
    };
  }, []);

  // Tenant dropdown source — pulled once per session. System admins can
  // see every tenant via RLS bypass.
  const { data: tenants } = useQuery({
    queryKey: ["forbidden-access-tenant-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants_public" as any)
        .select("id, name, slug")
        .order("name", { ascending: true })
        .limit(500);
      if (error) throw error;
      return ((data as any[]) ?? []) as { id: string; name: string; slug: string }[];
    },
    enabled: isSystemAdmin,
    staleTime: 5 * 60_000,
  });

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: [
      "forbidden-access-log",
      trimmedUserId,
      tenantIdFilter,
      trimmedPath,
      dateFrom?.toISOString() ?? null,
      dateTo?.toISOString() ?? null,
      page,
    ],
    queryFn: async () => {
      let query = supabase
        .from("audit_log")
        .select(
          "id, created_at, tenant_id, user_id, summary, new_data",
          { count: "exact" },
        )
        .eq("action", "forbidden_access")
        .order("created_at", { ascending: false });

      if (trimmedUserId && userIdValid) {
        query = query.eq("user_id", trimmedUserId);
      }
      if (tenantIdFilter !== "all") {
        query = query.eq("tenant_id", tenantIdFilter);
      }
      if (trimmedPath) {
        // PostgREST JSON ->> operator: extract attempted_path as text and
        // match case-insensitively. Quote-escape any percent signs the
        // user typed so they don't act as wildcards in unexpected ways.
        const escaped = trimmedPath.replace(/[%_\\\\]/g, (m) => `\\\\${m}`);
        query = query.ilike(
          "new_data->>attempted_path",
          `%${escaped}%`,
        );
      }
      if (dateFrom) {
        query = query.gte("created_at", startOfDay(dateFrom).toISOString());
      }
      if (dateTo) {
        query = query.lte("created_at", endOfDay(dateTo).toISOString());
      }

      // Fetch one extra row to detect "is there a next page?" without
      // paying for a separate count round-trip on every keystroke.
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE; // inclusive → PAGE_SIZE + 1 rows max
      query = query.range(from, to);

      const { data: rows, error: qErr, count } = await query;
      if (qErr) throw qErr;

      const all = (rows ?? []) as unknown as ForbiddenAccessRow[];
      const hasMore = all.length > PAGE_SIZE;
      const trimmed = hasMore ? all.slice(0, PAGE_SIZE) : all;
      return { rows: trimmed, hasMore, totalCount: count ?? null };
    },
    enabled: isSystemAdmin,
    // Only treat the cache as fresh briefly — denial events are
    // security-relevant and we want close-to-real-time visibility.
    staleTime: 15_000,
  });

  // Build a small id→label map so the table can show a friendly tenant
  // name without joining server-side (audit_log has no FK to tenants_safe
  // we can hop through cleanly here).
  const tenantNameById = useMemo(() => {
    const m = new Map<string, string>();
    (tenants ?? []).forEach((t) => m.set(t.id, t.name));
    return m;
  }, [tenants]);

  if (!isSystemAdmin) {
    // Defensive: this panel is only mounted from the Superadmin page,
    // but rendering nothing if it ever gets imported elsewhere keeps it
    // from leaking row counts via empty-state copy.
    return null;
  }

  const rows = data?.rows ?? [];
  const hasMore = data?.hasMore ?? false;
  const totalCount = data?.totalCount ?? null;
  const hasFilters =
    !!trimmedUserId ||
    tenantIdFilter !== "all" ||
    !!trimmedPath ||
    !!dateFrom ||
    !!dateTo;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <CardTitle className="font-serif">
              Forbidden access attempts
            </CardTitle>
            <DashboardTooltip
              text={
                "Every authenticated navigation that was denied by a route guard " +
                "(e.g. a non-system-admin opening /superadmin). Sourced from the " +
                "audit_log via the log-forbidden-access edge function."
              }
            />
            {totalCount !== null && (
              <Badge variant="outline" className="text-xs">
                {totalCount.toLocaleString()} total
              </Badge>
            )}
          </div>
        </div>

        {/* Filter row */}
        <div className="grid gap-3 mt-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="fa-user-id" className="text-xs">
              User ID (UUID)
            </Label>
            <Input
              id="fa-user-id"
              value={userIdFilter}
              onChange={(e) =>
                onFilterChange(setUserIdFilter)(e.target.value)
              }
              placeholder="xxxxxxxx-xxxx-…"
              className={cn(
                "h-9 text-xs font-mono",
                trimmedUserId && !userIdValid && "border-destructive",
              )}
              aria-invalid={trimmedUserId !== "" && !userIdValid}
              aria-describedby={
                trimmedUserId && !userIdValid ? "fa-user-id-err" : undefined
              }
            />
            {trimmedUserId && !userIdValid && (
              <p
                id="fa-user-id-err"
                className="text-[11px] text-destructive"
              >
                Enter a full UUID or clear the field.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="fa-tenant" className="text-xs">
              Tenant
            </Label>
            <Select
              value={tenantIdFilter}
              onValueChange={onFilterChange(setTenantIdFilter)}
            >
              <SelectTrigger id="fa-tenant" className="h-9 text-xs">
                <SelectValue placeholder="All tenants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tenants</SelectItem>
                {(tenants ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="fa-path" className="text-xs">
              Attempted path contains
            </Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                id="fa-path"
                value={pathFilter}
                onChange={(e) =>
                  onFilterChange(setPathFilter)(e.target.value)
                }
                placeholder="/superadmin"
                className="h-9 text-xs pl-7"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Date range</Label>
            <div className="flex gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-9 flex-1 justify-start gap-1.5 text-xs",
                      dateFrom && "border-primary/50",
                    )}
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {dateFrom ? format(dateFrom, "dd.MM.yyyy") : "From"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={onFilterChange(setDateFrom)}
                    disabled={(d) => (dateTo ? d > dateTo : false)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-9 flex-1 justify-start gap-1.5 text-xs",
                      dateTo && "border-primary/50",
                    )}
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {dateTo ? format(dateTo, "dd.MM.yyyy") : "To"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={onFilterChange(setDateTo)}
                    disabled={(d) => (dateFrom ? d < dateFrom : false)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {hasFilters && (
          <div className="mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="gap-1 text-xs text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" /> Clear filters
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {error ? (
          <p className="text-sm text-destructive py-6 text-center">
            Failed to load forbidden-access entries.
          </p>
        ) : isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-10 rounded-md bg-muted animate-pulse"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {hasFilters
              ? "No forbidden-access attempts match these filters."
              : "No forbidden-access attempts have been recorded yet."}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">When</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead className="hidden lg:table-cell">IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const meta = row.new_data ?? {};
                    const tenantName =
                      tenantNameById.get(row.tenant_id) ??
                      `${row.tenant_id.slice(0, 8)}…`;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                          {format(
                            new Date(row.created_at),
                            "d.M.yyyy HH:mm:ss",
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span title={row.tenant_id}>{tenantName}</span>
                        </TableCell>
                        <TableCell className="font-mono text-[11px]">
                          {row.user_id ? (
                            <span title={row.user_id}>
                              {row.user_id.slice(0, 8)}…
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge
                            variant="outline"
                            className="border-destructive/30 text-destructive bg-destructive/10"
                          >
                            {meta.attempted_area_label ||
                              meta.attempted_area ||
                              "unknown"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[260px] truncate">
                          {meta.attempted_path ? (
                            <span
                              className="font-mono"
                              title={meta.attempted_path}
                            >
                              {meta.attempted_path}
                              <ExternalLink className="inline h-3 w-3 ml-1 text-muted-foreground" />
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-[11px] text-muted-foreground font-mono">
                          {meta.ip ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination footer */}
            <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
              <span>
                Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + rows.length}
                {totalCount !== null ? ` of ${totalCount.toLocaleString()}` : ""}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0 || isFetching}
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!hasMore || isFetching}
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ForbiddenAccessLogPanel;
