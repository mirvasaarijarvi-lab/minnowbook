import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useT } from "@/contexts/I18nContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle, Clock, MessageSquare, Flag } from "lucide-react";
import { format } from "date-fns";
import DashboardTooltip from "./DashboardTooltip";

interface SupportRequest {
  id: string;
  tenant_id: string;
  user_id: string;
  subject: string;
  message: string;
  status: string;
  admin_response: string | null;
  responded_at: string | null;
  is_read_by_user: boolean;
  created_at: string;
}

const SupportRequestsBoard = () => {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const t = useT();
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);
  const [response, setResponse] = useState("");

  const { data: requests, isLoading } = useQuery({
    queryKey: ["support-requests", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("support_requests")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SupportRequest[];
    },
    enabled: !!tenantId,
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, adminResponse }: { id: string; adminResponse: string }) => {
      const { error } = await supabase
        .from("support_requests")
        .update({
          admin_response: adminResponse,
          status: "fixed",
          responded_at: new Date().toISOString(),
          is_read_by_user: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-requests"] });
      setSelectedRequest(null);
      setResponse("");
      toast.success(t("admin.reverted"));
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to respond");
    },
  });

  const openRequests = requests?.filter((r) => r.status === "open") ?? [];
  const fixedRequests = requests?.filter((r) => r.status === "fixed") ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Flag className="h-5 w-5 text-primary" />
          <CardTitle className="font-serif">{t("admin.supportRequests")}</CardTitle>
          {openRequests.length > 0 && (
            <Badge variant="destructive" className="text-xs">{openRequests.length} {t("admin.open").toLowerCase()}</Badge>
          )}
          <DashboardTooltip text={t("admin.supportRequestsDesc")} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : !requests?.length ? (
          <div className="text-center py-10">
            <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{t("admin.noSupportRequests")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("admin.supportRequestsDesc")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {openRequests.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t("admin.open")}</h4>
                {openRequests.map((req) => (
                  <RequestCard key={req.id} request={req} onSelect={setSelectedRequest} t={t} />
                ))}
              </div>
            )}
            {fixedRequests.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t("admin.resolved")}</h4>
                {fixedRequests.map((req) => (
                  <RequestCard key={req.id} request={req} onSelect={setSelectedRequest} t={t} />
                ))}
              </div>
            )}
          </div>
        )}

        <Dialog open={!!selectedRequest} onOpenChange={(open) => { if (!open) { setSelectedRequest(null); setResponse(""); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-serif">{selectedRequest?.subject}</DialogTitle>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4">
                <div className="bg-secondary/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    {format(new Date(selectedRequest.created_at), "MMM d, yyyy 'at' HH:mm")}
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{selectedRequest.message}</p>
                </div>
                {selectedRequest.admin_response ? (
                  <div className="bg-accent/5 border border-accent/20 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-accent" />
                      {selectedRequest.responded_at && format(new Date(selectedRequest.responded_at), "MMM d, yyyy 'at' HH:mm")}
                    </p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{selectedRequest.admin_response}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Textarea value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Write your response..." rows={4} />
                    <Button
                      onClick={() => respondMutation.mutate({ id: selectedRequest.id, adminResponse: response })}
                      disabled={!response.trim() || respondMutation.isPending}
                      className="w-full gap-1.5"
                    >
                      <MessageSquare className="h-4 w-4" />
                      {respondMutation.isPending ? t("admin.sending") : t("admin.respondMarkFixed")}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

const RequestCard = ({ request, onSelect, t }: { request: SupportRequest; onSelect: (r: SupportRequest) => void; t: (key: any) => string }) => {
  const isOpen = request.status === "open";

  return (
    <div
      className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30 transition-colors"
      onClick={() => onSelect(request)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm text-foreground truncate">{request.subject}</span>
          <Badge variant="outline" className={`text-xs shrink-0 ${isOpen ? "border-warning/30 text-warning bg-warning/10" : "border-success/30 text-success bg-success/10"}`}>
            {isOpen ? <Clock className="h-3 w-3 mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
            {isOpen ? t("admin.open") : t("admin.resolved")}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{request.message}</p>
        <p className="text-xs text-muted-foreground mt-1">{format(new Date(request.created_at), "d.M.yyyy")}</p>
      </div>
    </div>
  );
};

export default SupportRequestsBoard;
