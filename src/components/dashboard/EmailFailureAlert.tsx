import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Mail } from "lucide-react";
import { useTierGate } from "@/hooks/useTierGate";

const EmailFailureAlert = () => {
  const { isSystemAdmin } = useTierGate();

  const { data: failureStats } = useQuery({
    queryKey: ["email-failure-monitor"],
    queryFn: async () => {
      // Check last 24 hours for failed/dlq emails
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("email_send_log")
        .select("id, status, created_at, recipient_email, template_name, error_message")
        .in("status", ["failed", "dlq"])
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: isSystemAdmin,
    refetchInterval: 60_000, // poll every 60s
  });

  if (!isSystemAdmin || !failureStats?.length) return null;

  const failedCount = failureStats.filter((e) => e.status === "failed").length;
  const dlqCount = failureStats.filter((e) => e.status === "dlq").length;
  const latestError = failureStats[0];

  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
        <h3 className="font-semibold text-destructive text-sm">
          Email Delivery Issues (Last 24h)
        </h3>
      </div>
      <div className="flex items-center gap-4 text-sm">
        {failedCount > 0 && (
          <span className="text-destructive font-medium">
            {failedCount} failed
          </span>
        )}
        {dlqCount > 0 && (
          <span className="text-destructive font-medium">
            {dlqCount} dead-lettered
          </span>
        )}
      </div>
      {latestError && (
        <div className="text-xs text-muted-foreground space-y-0.5">
          <p>
            <Mail className="inline h-3 w-3 mr-1" />
            Latest: <span className="font-mono">{latestError.recipient_email}</span>
            {" · "}
            <span className="italic">{latestError.template_name}</span>
          </p>
          {latestError.error_message && (
            <p className="text-destructive/80 truncate max-w-xl">
              Error: {latestError.error_message}
            </p>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Check the Beta & Email Log panel in Superadmin for full details.
      </p>
    </div>
  );
};

export default EmailFailureAlert;
