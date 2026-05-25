import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, ShieldAlert, RefreshCw } from "lucide-react";
import { toast } from "sonner";

// Superadmin-only panel: configures and runs the automated cleanup of
// test reservations (e.g. `TEST Lovable Cross%`). The same function powers
// the manual "Run now" button and any pg_cron schedule the operator wires up.
const TestReservationCleanupPanel = () => {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ["test-cleanup-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_reservation_cleanup_config" as any)
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: logs } = useQuery({
    queryKey: ["test-cleanup-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_reservation_cleanup_log" as any)
        .select("*")
        .order("triggered_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const [pattern, setPattern] = useState<string>("");
  const [cutoff, setCutoff] = useState<string>("");
  const [enabled, setEnabled] = useState<boolean>(false);
  const hydrated = !isLoading && config;
  if (hydrated && pattern === "" && cutoff === "" && enabled === false) {
    // First render after load: seed local state from the row.
    if (config.name_pattern) setPattern(config.name_pattern);
    if (config.cutoff_date) setCutoff(config.cutoff_date);
    if (config.is_enabled) setEnabled(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name_pattern: pattern || "TEST Lovable Cross%",
        cutoff_date: cutoff || null,
        is_enabled: enabled,
        updated_at: new Date().toISOString(),
        updated_by: (await supabase.auth.getUser()).data.user?.id ?? null,
      };
      if (config?.id) {
        const { error } = await supabase
          .from("test_reservation_cleanup_config" as any)
          .update(payload)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("test_reservation_cleanup_config" as any)
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Cleanup settings saved");
      qc.invalidateQueries({ queryKey: ["test-cleanup-config"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save"),
  });

  const runNow = async () => {
    setRunning(true);
    const { data, error } = await supabase.rpc("run_test_reservation_cleanup" as any, {
      p_source: "manual",
      p_override_pattern: pattern || null,
      p_override_cutoff: cutoff || null,
    });
    setRunning(false);
    setConfirmOpen(false);
    if (error) {
      toast.error(`Cleanup failed: ${error.message}`);
      return;
    }
    const n = Number(data ?? 0);
    toast.success(n === 0 ? "No matching reservations to delete" : `Deleted ${n} reservation${n === 1 ? "" : "s"}`);
    qc.invalidateQueries({ queryKey: ["test-cleanup-log"] });
    qc.invalidateQueries({ queryKey: ["reservations"] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-serif">
          <ShieldAlert className="h-5 w-5 text-destructive" />
          Test Reservation Cleanup
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Automatically remove test reservations whose guest name matches a pattern,
          on or before a cutoff date. Used to keep production clean of synthetic
          data like "TEST Lovable Cross". Every run is logged below.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="cleanup-pattern">Guest name pattern (SQL ILIKE)</Label>
            <Input
              id="cleanup-pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="TEST Lovable Cross%"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cleanup-cutoff">Cutoff date (delete on or before)</Label>
            <Input
              id="cleanup-cutoff"
              type="date"
              value={cutoff}
              onChange={(e) => setCutoff(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Scheduled cleanup</Label>
            <div className="flex items-center gap-2 h-10">
              <Switch checked={enabled} onCheckedChange={setEnabled} />
              <span className="text-sm text-muted-foreground">
                {enabled ? "Cron runs will delete" : "Cron runs skip (log only)"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving..." : "Save settings"}
          </Button>
          <Button
            variant="destructive"
            className="gap-1.5"
            onClick={() => setConfirmOpen(true)}
            disabled={running}
          >
            <Trash2 className="h-4 w-4" />
            Run cleanup now
          </Button>
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => qc.invalidateQueries({ queryKey: ["test-cleanup-log"] })}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh log
          </Button>
        </div>

        <div className="rounded-md border">
          <div className="px-3 py-2 border-b bg-muted/50 text-sm font-medium">
            Cleanup history (latest 20)
          </div>
          <div className="divide-y">
            {(logs ?? []).length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">No cleanup runs yet.</div>
            )}
            {(logs ?? []).map((row) => (
              <details key={row.id} className="group">
                <summary className="flex flex-wrap items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/30">
                  <span className="text-sm font-mono">
                    {format(new Date(row.triggered_at), "yyyy-MM-dd HH:mm")}
                  </span>
                  <Badge variant={row.trigger_source === "cron" ? "secondary" : "outline"}>
                    {row.trigger_source}
                  </Badge>
                  <Badge variant={row.deleted_count > 0 ? "destructive" : "outline"}>
                    {row.deleted_count} deleted
                  </Badge>
                  <span className="text-xs text-muted-foreground truncate">
                    pattern: <code>{row.name_pattern}</code>
                    {row.cutoff_date ? <> · cutoff: {row.cutoff_date}</> : null}
                    {row.notes ? <> · {row.notes}</> : null}
                  </span>
                </summary>
                <pre className="px-3 py-2 text-xs overflow-x-auto bg-muted/20 max-h-64">
                  {JSON.stringify(row.deleted_rows ?? [], null, 2)}
                </pre>
              </details>
            ))}
          </div>
        </div>
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={(open) => !running && setConfirmOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Run test reservation cleanup?
            </DialogTitle>
            <DialogDescription>
              This permanently deletes every reservation whose guest name matches
              <code className="mx-1">{pattern || "TEST Lovable Cross%"}</code>
              {cutoff ? <>with a reservation date on or before <strong>{cutoff}</strong>.</> : "across all dates."}
              {" "}The full list of deleted rows will be stored in the cleanup log.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={running}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={runNow} disabled={running}>
              {running ? "Running..." : "Delete now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default TestReservationCleanupPanel;
