import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle, Clock, MessageSquare, Flag } from "lucide-react";
import { format } from "date-fns";

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

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  open: { label: "Open", color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Clock },
  fixed: { label: "Fixed", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
};

const SupportRequestsBoard = () => {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
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
      toast.success("Response sent and request marked as fixed");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to respond");
    },
  });

  const openRequests = requests?.filter((r) => r.status === "open") ?? [];
  const fixedRequests = requests?.filter((r) => r.status === "fixed") ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Flag className="h-5 w-5 text-accent" />
        <h3 className="text-lg font-serif font-semibold text-foreground">Support Requests</h3>
        {openRequests.length > 0 && (
          <Badge variant="destructive" className="text-xs">{openRequests.length} open</Badge>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-4 h-20" /></Card>
          ))}
        </div>
      ) : !requests?.length ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No support requests yet. Business tier users can submit requests via the chat widget.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Open requests */}
          {openRequests.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Open</h4>
              {openRequests.map((req) => (
                <RequestCard key={req.id} request={req} onSelect={setSelectedRequest} />
              ))}
            </div>
          )}

          {/* Fixed requests */}
          {fixedRequests.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Resolved</h4>
              {fixedRequests.map((req) => (
                <RequestCard key={req.id} request={req} onSelect={setSelectedRequest} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Response dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => { if (!open) { setSelectedRequest(null); setResponse(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">{selectedRequest?.subject}</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="bg-secondary/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">
                  Submitted {format(new Date(selectedRequest.created_at), "MMM d, yyyy 'at' HH:mm")}
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{selectedRequest.message}</p>
              </div>

              {selectedRequest.admin_response ? (
                <div className="bg-accent/5 border border-accent/20 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-accent" />
                    Response sent {selectedRequest.responded_at && format(new Date(selectedRequest.responded_at), "MMM d, yyyy 'at' HH:mm")}
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{selectedRequest.admin_response}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Textarea
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    placeholder="Write your response..."
                    rows={4}
                  />
                  <Button
                    onClick={() => respondMutation.mutate({ id: selectedRequest.id, adminResponse: response })}
                    disabled={!response.trim() || respondMutation.isPending}
                    className="w-full gap-1.5"
                  >
                    <MessageSquare className="h-4 w-4" />
                    {respondMutation.isPending ? "Sending..." : "Respond & Mark as Fixed"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const RequestCard = ({ request, onSelect }: { request: SupportRequest; onSelect: (r: SupportRequest) => void }) => {
  const config = statusConfig[request.status] ?? statusConfig.open;
  const StatusIcon = config.icon;

  return (
    <Card
      className="cursor-pointer hover:shadow-hover transition-shadow"
      onClick={() => onSelect(request)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm text-foreground truncate">{request.subject}</span>
              <Badge variant="outline" className={`text-xs shrink-0 ${config.color}`}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {config.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{request.message}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {format(new Date(request.created_at), "MMM d, yyyy")}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SupportRequestsBoard;
