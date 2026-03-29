import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useT } from "@/contexts/I18nContext";
import { useDateLocale } from "@/hooks/useDateLocale";
import { Bell, CheckCircle2, Receipt, X, CheckCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const NotificationBell = () => {
  const t = useT();
  const { tenantId } = useTenant();
  const dateFnsLocale = useDateLocale();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
    refetchInterval: 30_000,
  });

  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", tenantId] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!tenantId) return;
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("tenant_id", tenantId)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", tenantId] }),
  });

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "reservation_used":
        return <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />;
      case "reservation_invoiced":
        return <Receipt className="h-4 w-4 text-accent shrink-0" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground"
          aria-label={t("notifications.title")}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground px-1">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(380px,calc(100vw-2rem))] p-0"
        align="end"
        sideOffset={8}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm text-foreground">{t("notifications.title")}</h3>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-muted-foreground"
                onClick={() => markAllRead.mutate()}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {t("notifications.markAllRead")}
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t("notifications.empty")}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n: any) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex gap-3 px-4 py-3 text-sm transition-colors",
                    !n.is_read && "bg-primary/5"
                  )}
                >
                  <div className="mt-0.5">{getIcon(n.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-foreground", !n.is_read && "font-medium")}>
                      {n.type === "reservation_used"
                        ? t("notifications.used")
                        : n.type === "reservation_invoiced"
                        ? t("notifications.invoiced")
                        : n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: dateFnsLocale })}
                    </p>
                  </div>
                  {!n.is_read && (
                    <button
                      onClick={() => markAsRead.mutate(n.id)}
                      className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground"
                      aria-label={t("notifications.markRead")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
