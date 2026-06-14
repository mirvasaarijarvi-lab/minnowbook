import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/I18nContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Download, Loader2, ShieldAlert, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { FunctionsHttpError } from "@supabase/supabase-js";

type DeletionRow = {
  user_id: string;
  status: "pending" | "cancelled" | "purged" | "failed";
  requested_at: string;
  purge_after: string;
};

async function decodeFnError(err: unknown): Promise<string> {
  if (err instanceof FunctionsHttpError) {
    try {
      const body = await err.context.json();
      return body?.message ?? body?.error ?? err.message;
    } catch {
      return err.message;
    }
  }
  return (err as Error)?.message ?? "Unknown error";
}

export default function PrivacyDataPanel() {
  const { user } = useAuth();
  const t = useT();
  const queryClient = useQueryClient();
  const [confirmText, setConfirmText] = useState("");

  const { data: pending } = useQuery<DeletionRow | null>({
    queryKey: ["pending-account-deletion", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("pending_account_deletions")
        .select("user_id, status, requested_at, purge_after")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return (data as DeletionRow | null) ?? null;
    },
    enabled: !!user?.id,
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("export-user-data", {
        method: "POST",
      });
      if (error) {
        const msg = await decodeFnError(error);
        throw new Error(msg);
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mimmobook-data-export-${user?.id ?? "me"}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success(t("privacy.export.success")),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("request-account-deletion", {
        method: "POST",
        body: { confirm: confirmText.trim() },
      });
      if (error) {
        const msg = await decodeFnError(error);
        throw new Error(msg);
      }
      return data;
    },
    onSuccess: () => {
      toast.success(t("privacy.delete.requested"));
      queryClient.invalidateQueries({ queryKey: ["pending-account-deletion"] });
      setConfirmText("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("cancel-account-deletion", {
        method: "POST",
      });
      if (error) {
        const msg = await decodeFnError(error);
        throw new Error(msg);
      }
    },
    onSuccess: () => {
      toast.success(t("privacy.delete.cancelled"));
      queryClient.invalidateQueries({ queryKey: ["pending-account-deletion"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hasPending = pending?.status === "pending";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("privacy.panel.title")}</CardTitle>
        <CardDescription>{t("privacy.panel.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t("privacy.export.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("privacy.export.description")}</p>
          <div>
            <Button
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
              variant="outline"
            >
              {exportMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {t("privacy.export.button")}
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-2 border-t border-border pt-6">
          <h3 className="text-sm font-medium">{t("privacy.delete.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("privacy.delete.description")}</p>

          {hasPending ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 flex flex-col gap-2">
              <p className="text-sm">
                {t("privacy.delete.scheduled").replace(
                  "{date}",
                  new Date(pending!.purge_after).toLocaleString(),
                )}
              </p>
              <div>
                <Button
                  variant="outline"
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                >
                  {cancelMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Undo2 className="h-4 w-4 mr-2" />
                  )}
                  {t("privacy.delete.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-fit">
                  <ShieldAlert className="h-4 w-4 mr-2" />
                  {t("privacy.delete.button")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("privacy.delete.confirmTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("privacy.delete.confirmDescription")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="delete-confirm">{t("privacy.delete.confirmLabel")}</Label>
                  <Input
                    id="delete-confirm"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="DELETE"
                    autoComplete="off"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setConfirmText("")}>
                    {t("common.cancel")}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={confirmText.trim() !== "DELETE" || deleteMutation.isPending}
                    onClick={(e) => {
                      e.preventDefault();
                      deleteMutation.mutate();
                    }}
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {t("privacy.delete.confirmAction")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
