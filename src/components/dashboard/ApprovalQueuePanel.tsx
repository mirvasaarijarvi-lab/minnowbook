import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useT } from "@/contexts/I18nContext";
import type { TranslationKey } from "@/i18n/translations";
import { PERM_SITES_APPROVE } from "@/lib/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Clock, FileText } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

type ApprovalTable =
  | "resources"
  | "blocked_slots"
  | "recurring_blocked_slots"
  | "tenant_opening_hours"
  | "tenant_email_templates";

interface PendingItem {
  id: string;
  table: ApprovalTable;
  label: string;
  detail: string;
  site_name: string | null;
  created_at: string;
}

const TABLE_LABEL_KEYS: Record<ApprovalTable, TranslationKey> = {
  resources: "approval.typeResource",
  blocked_slots: "approval.typeBlockedSlot",
  recurring_blocked_slots: "approval.typeRecurringBlock",
  tenant_opening_hours: "approval.typeOpeningHours",
  tenant_email_templates: "approval.typeEmailTemplate",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const ApprovalQueuePanel = () => {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { can } = usePermissions();
  const t = useT();
  const queryClient = useQueryClient();
  const canApprove = can(PERM_SITES_APPROVE);

  const [rejectDialog, setRejectDialog] = useState<PendingItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Fetch all pending items across the 5 approval tables
  const { data: pendingItems, isLoading } = useQuery({
    queryKey: ["approval-queue", tenantId],
    queryFn: async () => {
      const items: PendingItem[] = [];

      // Fetch sites for name lookup
      const { data: sites } = await supabase
        .from("sites")
        .select("id, name")
        .eq("tenant_id", tenantId!);
      const siteMap = new Map((sites ?? []).map((s) => [s.id, s.name]));

      // Resources
      const { data: resources } = await supabase
        .from("resources")
        .select("id, name, resource_type, site_id, created_at")
        .eq("tenant_id", tenantId!)
        .eq("approval_status", "pending");
      (resources ?? []).forEach((r) =>
        items.push({
          id: r.id,
          table: "resources",
          label: r.name,
          detail: r.resource_type,
          site_name: r.site_id ? siteMap.get(r.site_id) ?? null : null,
          created_at: r.created_at ?? "",
        })
      );

      // Blocked slots
      const { data: blocks } = await supabase
        .from("blocked_slots")
        .select("id, date, reason, resource_type, site_id, created_at")
        .eq("tenant_id", tenantId!)
        .eq("approval_status", "pending");
      (blocks ?? []).forEach((b) =>
        items.push({
          id: b.id,
          table: "blocked_slots",
          label: `${b.date} — ${b.resource_type}`,
          detail: b.reason || t("approval.noReason"),
          site_name: b.site_id ? siteMap.get(b.site_id) ?? null : null,
          created_at: b.created_at ?? "",
        })
      );

      // Recurring blocked slots
      const { data: recurring } = await supabase
        .from("recurring_blocked_slots")
        .select("id, day_of_week, reason, resource_type, site_id, created_at")
        .eq("tenant_id", tenantId!)
        .eq("approval_status", "pending");
      (recurring ?? []).forEach((r) =>
        items.push({
          id: r.id,
          table: "recurring_blocked_slots",
          label: `${DAY_NAMES[r.day_of_week]} — ${r.resource_type}`,
          detail: r.reason || t("approval.noReason"),
          site_name: r.site_id ? siteMap.get(r.site_id) ?? null : null,
          created_at: r.created_at ?? "",
        })
      );

      // Opening hours
      const { data: hours } = await supabase
        .from("tenant_opening_hours")
        .select("id, day_of_week, resource_type, open_time, close_time, is_closed, site_id, created_at")
        .eq("tenant_id", tenantId!)
        .eq("approval_status", "pending");
      (hours ?? []).forEach((h) =>
        items.push({
          id: h.id,
          table: "tenant_opening_hours",
          label: `${DAY_NAMES[h.day_of_week]} — ${h.resource_type}`,
          detail: h.is_closed ? t("approval.closed") : `${h.open_time ?? "?"} – ${h.close_time ?? "?"}`,
          site_name: h.site_id ? siteMap.get(h.site_id) ?? null : null,
          created_at: h.created_at ?? "",
        })
      );

      // Email templates
      const { data: templates } = await supabase
        .from("tenant_email_templates")
        .select("id, template_type, subject, language, site_id, created_at")
        .eq("tenant_id", tenantId!)
        .eq("approval_status", "pending");
      (templates ?? []).forEach((t) =>
        items.push({
          id: t.id,
          table: "tenant_email_templates",
          label: `${t.template_type} (${t.language ?? "en"})`,
          detail: t.subject,
          site_name: t.site_id ? siteMap.get(t.site_id) ?? null : null,
          created_at: t.created_at ?? "",
        })
      );

      return items;
    },
    enabled: !!tenantId,
  });

  const approveMutation = useMutation({
    mutationFn: async (item: PendingItem) => {
      const { error } = await supabase
        .from(item.table)
        .update({
          approval_status: "approved",
          approved_by: user!.id,
          rejection_reason: null,
        } as any)
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approval-queue", tenantId] });
      toast({ title: t("approval.approved") });
    },
    onError: (err: any) => {
      toast({ title: t("common.status"), description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ item, reason }: { item: PendingItem; reason: string }) => {
      const { error } = await supabase
        .from(item.table)
        .update({
          approval_status: "rejected",
          approved_by: user!.id,
          rejection_reason: reason,
        } as any)
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approval-queue", tenantId] });
      setRejectDialog(null);
      setRejectionReason("");
      toast({ title: t("approval.rejected") });
    },
    onError: (err: any) => {
      toast({ title: t("common.status"), description: err.message, variant: "destructive" });
    },
  });

  const handleReject = () => {
    if (!rejectDialog || !rejectionReason.trim()) return;
    rejectMutation.mutate({ item: rejectDialog, reason: rejectionReason.trim() });
  };

  const count = pendingItems?.length ?? 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (count === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">{t("approval.noItems")}</p>
          <p className="text-xs mt-1">{t("approval.noItemsDesc")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("approval.colType")}</TableHead>
                <TableHead>{t("approval.colName")}</TableHead>
                <TableHead>{t("approval.colDetail")}</TableHead>
                <TableHead>{t("approval.colSite")}</TableHead>
                <TableHead>{t("approval.colSubmitted")}</TableHead>
                {canApprove && <TableHead className="text-right">{t("approval.colActions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingItems!.map((item) => (
                <TableRow key={`${item.table}-${item.id}`}>
                  <TableCell>
                    <Badge variant="outline" className="text-xs whitespace-nowrap">
                      <FileText className="h-3 w-3 mr-1" />
                      {t(TABLE_LABEL_KEYS[item.table])}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{item.label}</TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                    {item.detail}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.site_name ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {item.created_at
                      ? format(new Date(item.created_at), "d MMM yyyy")
                      : "—"}
                  </TableCell>
                  {canApprove && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                          onClick={() => approveMutation.mutate(item)}
                          disabled={approveMutation.isPending}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {t("approval.approve")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-xs text-destructive hover:text-destructive"
                          onClick={() => {
                            setRejectDialog(item);
                            setRejectionReason("");
                          }}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          {t("approval.reject")}
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Rejection reason dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={(open) => !open && setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">{t("approval.rejectChange")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              {t("approval.rejectingLabel")} <strong>{rejectDialog?.label}</strong> ({t(TABLE_LABEL_KEYS[rejectDialog?.table ?? "resources"])})
            </p>
            <Textarea
              placeholder={t("approval.rejectionReason")}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
            <Button
              className="w-full"
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? t("approval.rejecting") : t("approval.reject")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ApprovalQueuePanel;
