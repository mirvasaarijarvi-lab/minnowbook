import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquareHeart, Star, TrendingUp, Users, Calendar, Mail, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const ratingEmojis: Record<number, string> = {
  1: "😞",
  2: "😕",
  3: "😐",
  4: "😊",
  5: "🤩",
};

const ratingLabels: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Okay",
  4: "Good",
  5: "Amazing",
};

const statusConfig: Record<string, { color: string; icon: typeof CheckCircle2; label: string }> = {
  sent: { color: "text-green-600 bg-green-100 dark:bg-green-900/30", icon: CheckCircle2, label: "Sent" },
  pending: { color: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30", icon: Clock, label: "Pending" },
  failed: { color: "text-destructive bg-red-100 dark:bg-red-900/30", icon: XCircle, label: "Failed" },
  dlq: { color: "text-destructive bg-red-100 dark:bg-red-900/30", icon: XCircle, label: "Dead Letter" },
  suppressed: { color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30", icon: AlertTriangle, label: "Suppressed" },
  bounced: { color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30", icon: AlertTriangle, label: "Bounced" },
};

const BetaFeedbackPanel = () => {
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [emailStatusFilter, setEmailStatusFilter] = useState<string>("all");

  const { data: feedback, isLoading } = useQuery({
    queryKey: ["beta-feedback-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beta_feedback")
        .select("*, tenants(name, slug)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
  });

  // Email send log query
  const { data: emailLogs, isLoading: emailLoading } = useQuery({
    queryKey: ["email-send-log-superadmin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_send_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
  });

  // Deduplicate by message_id, keep latest
  const deduped = (() => {
    const map = new Map<string, any>();
    (emailLogs ?? []).forEach((e: any) => {
      const key = e.message_id || e.id;
      if (!map.has(key) || new Date(e.created_at) > new Date(map.get(key).created_at)) {
        map.set(key, e);
      }
    });
    return Array.from(map.values());
  })();

  const filteredEmails = deduped.filter(
    (e: any) => emailStatusFilter === "all" || e.status === emailStatusFilter
  );

  const emailStats = {
    total: deduped.length,
    sent: deduped.filter((e: any) => e.status === "sent").length,
    pending: deduped.filter((e: any) => e.status === "pending").length,
    failed: deduped.filter((e: any) => ["failed", "dlq"].includes(e.status)).length,
  };

  const items = (feedback ?? []).filter(
    (f: any) => ratingFilter === "all" || f.rating === parseInt(ratingFilter)
  );

  // Stats
  const totalCount = (feedback ?? []).length;
  const avgRating =
    totalCount > 0
      ? ((feedback ?? []).reduce((s: number, f: any) => s + f.rating, 0) / totalCount).toFixed(1)
      : "—";
  const uniqueTenants = new Set((feedback ?? []).map((f: any) => f.tenant_id)).size;
  const withComments = (feedback ?? []).filter((f: any) => f.comment).length;

  // Rating distribution
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  (feedback ?? []).forEach((f: any) => {
    distribution[f.rating] = (distribution[f.rating] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <MessageSquareHeart className="h-5 w-5 text-accent" />
            <CardTitle className="text-xl font-serif">Beta Feedback</CardTitle>
          </div>
          <Select value={ratingFilter} onValueChange={setRatingFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ratings</SelectItem>
              {[5, 4, 3, 2, 1].map((r) => (
                <SelectItem key={r} value={String(r)}>
                  {ratingEmojis[r]} {ratingLabels[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center p-3 rounded-lg bg-secondary/50">
              <Star className="h-4 w-4 mx-auto text-accent mb-1" />
              <p className="text-2xl font-bold text-foreground">{avgRating}</p>
              <p className="text-xs text-muted-foreground">Avg Rating</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-secondary/50">
              <TrendingUp className="h-4 w-4 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold text-foreground">{totalCount}</p>
              <p className="text-xs text-muted-foreground">Total Feedback</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-secondary/50">
              <Users className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-bold text-foreground">{uniqueTenants}</p>
              <p className="text-xs text-muted-foreground">Tenants</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-secondary/50">
              <MessageSquareHeart className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-bold text-foreground">{withComments}</p>
              <p className="text-xs text-muted-foreground">With Comments</p>
            </div>
          </div>

          {/* Distribution bar */}
          {totalCount > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Rating Distribution</p>
              <div className="flex gap-1 h-6 rounded-md overflow-hidden">
                {[5, 4, 3, 2, 1].map((r) => {
                  const pct = totalCount > 0 ? (distribution[r] / totalCount) * 100 : 0;
                  if (pct === 0) return null;
                  const colors: Record<number, string> = {
                    5: "bg-green-500",
                    4: "bg-emerald-400",
                    3: "bg-yellow-400",
                    2: "bg-orange-400",
                    1: "bg-red-400",
                  };
                  return (
                    <div
                      key={r}
                      className={`${colors[r]} flex items-center justify-center text-[10px] font-bold text-white`}
                      style={{ width: `${pct}%`, minWidth: pct > 0 ? "24px" : 0 }}
                      title={`${ratingEmojis[r]} ${ratingLabels[r]}: ${distribution[r]}`}
                    >
                      {ratingEmojis[r]}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Feedback list */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-6 w-6 border-4 border-accent border-t-transparent rounded-full" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              {totalCount === 0 ? "No feedback yet." : "No feedback matching this filter."}
            </p>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {items.map((f: any) => (
                <div key={f.id} className="p-3 rounded-lg border border-border bg-card space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{ratingEmojis[f.rating]}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {ratingLabels[f.rating]}
                      </Badge>
                      {f.tenants?.name && (
                        <Badge variant="secondary" className="text-[10px]">
                          {f.tenants.name}
                        </Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(f.created_at), "MMM d, yyyy HH:mm")}
                    </span>
                  </div>
                  {f.comment && (
                    <p className="text-sm text-foreground leading-relaxed">{f.comment}</p>
                  )}
                  {f.page_context && (
                    <p className="text-[10px] text-muted-foreground">
                      From: {f.page_context}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Send Log */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-accent" />
            <CardTitle className="text-xl font-serif">Email Send Log</CardTitle>
          </div>
          <Select value={emailStatusFilter} onValueChange={setEmailStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="dlq">Dead Letter</SelectItem>
              <SelectItem value="suppressed">Suppressed</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center p-3 rounded-lg bg-secondary/50">
              <Mail className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-bold text-foreground">{emailStats.total}</p>
              <p className="text-xs text-muted-foreground">Total Emails</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-secondary/50">
              <CheckCircle2 className="h-4 w-4 mx-auto text-green-600 mb-1" />
              <p className="text-2xl font-bold text-foreground">{emailStats.sent}</p>
              <p className="text-xs text-muted-foreground">Sent</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-secondary/50">
              <Clock className="h-4 w-4 mx-auto text-yellow-600 mb-1" />
              <p className="text-2xl font-bold text-foreground">{emailStats.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-secondary/50">
              <XCircle className="h-4 w-4 mx-auto text-destructive mb-1" />
              <p className="text-2xl font-bold text-foreground">{emailStats.failed}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </div>

          {/* Email log list */}
          {emailLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-6 w-6 border-4 border-accent border-t-transparent rounded-full" />
            </div>
          ) : filteredEmails.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No emails found.</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {filteredEmails.map((e: any) => {
                const cfg = statusConfig[e.status] || statusConfig.pending;
                const StatusIcon = cfg.icon;
                return (
                  <div key={e.id} className="p-3 rounded-lg border border-border bg-card flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-[10px] ${cfg.color} border-0`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {cfg.label}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {e.template_name}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground truncate">{e.recipient_email}</p>
                      {e.error_message && (
                        <p className="text-[11px] text-destructive">{e.error_message}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(e.created_at), "MMM d, HH:mm")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BetaFeedbackPanel;
