import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useT } from "@/contexts/I18nContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Users, Loader2 } from "lucide-react";

interface TenantUser {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string;
  role: string;
  site_assignments: { site_id: string; role: string }[];
}

interface BulkAssignUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  siteName: string;
}

const BulkAssignUsersDialog = ({
  open,
  onOpenChange,
  siteId,
  siteName,
}: BulkAssignUsersDialogProps) => {
  const { tenantId } = useTenant();
  const t = useT();
  const queryClient = useQueryClient();
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [role, setRole] = useState("staff");

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users-for-bulk", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "list", tenantId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as TenantUser[];
    },
    enabled: !!tenantId && open,
  });

  // Pre-select users already assigned to this site
  const alreadyAssigned = new Set(
    (users ?? [])
      .filter((u) => u.site_assignments?.some((sa) => sa.site_id === siteId))
      .map((u) => u.user_id)
  );

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleAll = () => {
    if (!users) return;
    if (selectedUserIds.size === users.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(users.map((u) => u.user_id)));
    }
  };

  const assignMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: {
          action: "bulk_site_assignments",
          tenantId,
          siteId,
          userIds: Array.from(selectedUserIds),
          role,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users-for-bulk"] });
      onOpenChange(false);
      setSelectedUserIds(new Set());
      toast({
        title: t("admin.siteAssignmentsUpdated"),
        description: `${data.assigned} ${t("admin.usersAssigned" as any) || "users assigned"}`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const newSelections = Array.from(selectedUserIds).filter(
    (id) => !alreadyAssigned.has(id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t("sites.assignUsers" as any) || "Assign Users"} — {siteName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Role selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{t("admin.role")}:</span>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">{t("admin.staff")}</SelectItem>
                <SelectItem value="admin">{t("admin.adminRole")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* User list */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !users?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t("admin.noUsers")}
            </p>
          ) : (
            <>
              {/* Select all */}
              <div className="flex items-center gap-2 pb-1 border-b border-border">
                <Checkbox
                  checked={users.length > 0 && selectedUserIds.size === users.length}
                  onCheckedChange={toggleAll}
                  id="select-all"
                />
                <label htmlFor="select-all" className="text-xs font-medium cursor-pointer text-muted-foreground">
                  {t("common.selectAll" as any) || "Select all"} ({users.length})
                </label>
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-1">
                {users.map((user) => {
                  const isSelected = selectedUserIds.has(user.user_id);
                  const isAlready = alreadyAssigned.has(user.user_id);
                  return (
                    <div
                      key={user.user_id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-primary/5 border-primary/20"
                          : "bg-card border-border hover:bg-muted/50"
                      }`}
                      onClick={() => toggleUser(user.user_id)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleUser(user.user_id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {user.display_name || user.email}
                        </p>
                        {user.display_name && (
                          <p className="text-[11px] text-muted-foreground truncate">
                            {user.email}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="outline" className="text-[10px]">
                          {user.role}
                        </Badge>
                        {isAlready && (
                          <Badge variant="secondary" className="text-[10px]">
                            {t("sites.alreadyAssigned" as any) || "Assigned"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Summary + submit */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {selectedUserIds.size} {t("sites.usersSelected" as any) || "selected"}
              {newSelections.length > 0 && ` (${newSelections.length} new)`}
            </span>
            <Button
              onClick={() => assignMutation.mutate()}
              disabled={selectedUserIds.size === 0 || assignMutation.isPending}
              size="sm"
            >
              {assignMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  {t("common.saving")}
                </>
              ) : (
                t("sites.assignUsers" as any) || "Assign Users"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkAssignUsersDialog;
