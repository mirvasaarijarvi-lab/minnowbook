import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, Flag, Bell, Inbox, ChevronLeft, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { fi as fiFns, sv as svFns, enUS, type Locale } from "date-fns/locale";
import { useT, useLanguage } from "@/contexts/I18nContext";
import { TranslationKey } from "@/i18n/translations";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-chat`;

interface SupportChatWidgetProps {
  businessTier?: boolean;
}

const GUIDE_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

type ViewMode = "chat" | "requests";

const LOCALE_MAP: Record<string, Locale> = { fi: fiFns, sv: svFns, en: enUS };

const SupportChatWidget = ({ businessTier = false }: SupportChatWidgetProps) => {
  const t = useT();
  const { language } = useLanguage();
  const dateFnsLocale = LOCALE_MAP[language] ?? enUS;

  const statusConfig: Record<string, { icon: React.ElementType; label: string; className: string }> = {
    open: { icon: Clock, label: t("aid.statusOpen" as TranslationKey), className: "text-warning bg-warning/10" },
    "in-progress": { icon: Loader2, label: t("aid.statusInProgress" as TranslationKey), className: "text-info bg-info/10" },
    fixed: { icon: CheckCircle2, label: t("aid.statusResolved" as TranslationKey), className: "text-success bg-success/10" },
    closed: { icon: AlertCircle, label: t("aid.statusClosed" as TranslationKey), className: "text-muted-foreground bg-muted" },
  };

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [escalateMode, setEscalateMode] = useState(false);
  const [escalateSubject, setEscalateSubject] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { session } = useAuth();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-support-responses", tenantId],
    queryFn: async () => {
      if (!tenantId || !session?.user?.id) return 0;
      const { count, error } = await supabase
        .from("support_requests")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("user_id", session.user.id)
        .eq("status", "fixed")
        .eq("is_read_by_user", false);
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!tenantId && !!session?.user?.id && businessTier,
    refetchInterval: 30000,
  });

  const { data: supportRequests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["my-support-requests", tenantId, session?.user?.id],
    queryFn: async () => {
      if (!tenantId || !session?.user?.id) return [];
      const { data, error } = await supabase
        .from("support_requests")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId && !!session?.user?.id && businessTier && viewMode === "requests",
  });

  const markResponsesRead = async () => {
    if (!tenantId || !session?.user?.id || unreadCount === 0) return;
    await supabase
      .from("support_requests")
      .update({ is_read_by_user: true })
      .eq("tenant_id", tenantId)
      .eq("user_id", session.user.id)
      .eq("status", "fixed")
      .eq("is_read_by_user", false);
    queryClient.invalidateQueries({ queryKey: ["unread-support-responses"] });
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open && unreadCount > 0) {
      markResponsesRead();
    }
  }, [open]);

  const quickGuides = GUIDE_KEYS.map((n) => ({
    q: t(`aid.guideQ${n}` as TranslationKey),
    a: t(`aid.guideA${n}` as TranslationKey),
  }));

  const handleQuickGuide = (guide: { q: string; a: string }) => {
    setMessages((prev) => [
      ...prev,
      { role: "user", content: guide.q },
      { role: "assistant", content: guide.a },
    ]);
  };

  const sendAI = useCallback(async (userMessage: string) => {
    const userMsg: Message = { role: "user", content: userMessage };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    let assistantSoFar = "";
    const allMessages = [...messages, userMsg];

    try {
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        // apikey is always the project anon key (required by the Functions gateway)
        apikey: anonKey,
      };
      // Authorization carries the user's session if signed in, otherwise the
      // anon key so we never send an invalid/expired bearer that would trigger
      // an "Invalid session" error on public pages.
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      } else {
        headers.Authorization = `Bearer ${anonKey}`;
      }

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        headers,
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Something went wrong." }));
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: err.error || "Sorry, something went wrong. Please try again." },
        ]);
        setIsLoading(false);
        return;
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              const current = assistantSoFar;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: current } : m));
                }
                return [...prev, { role: "assistant", content: current }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error("Support chat error:", e);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: t("aid.errorConnect" as TranslationKey) },
      ]);
    }

    setIsLoading(false);
  }, [messages, session, t]);

  const handleSend = () => {
    if (!input.trim()) return;
    const msg = input.trim();
    setInput("");
    sendAI(msg);
  };

  const handleEscalate = async () => {
    if (!escalateSubject.trim() || !input.trim()) return;
    if (!tenantId) {
      toast.error(t("aid.errorNoTenant" as TranslationKey));
      return;
    }

    try {
      const { error } = await supabase.from("support_requests").insert({
        tenant_id: tenantId,
        user_id: session?.user?.id,
        subject: escalateSubject.trim(),
        message: input.trim(),
      });
      if (error) throw error;

      // Notify admin via email about escalation (fire-and-forget)
      supabase.functions.invoke("send-reminder", {
        body: {
          type: "escalation_notification",
          tenant_id: tenantId,
          subject: escalateSubject.trim(),
          message: input.trim(),
          user_email: session?.user?.email,
        },
      }).catch(() => {});

      setMessages((prev) => [
        ...prev,
        { role: "user", content: `📋 **${t("aid.requestSubmitted" as TranslationKey)}:** ${escalateSubject.trim()}\n${input.trim()}` },
        { role: "assistant", content: t("aid.requestSubmittedDetail" as TranslationKey) },
      ]);
      setInput("");
      setEscalateSubject("");
      setEscalateMode(false);
      queryClient.invalidateQueries({ queryKey: ["my-support-requests"] });
      toast.success(t("aid.successSubmit" as TranslationKey));
    } catch (e: any) {
      toast.error(e.message || t("aid.errorSubmit" as TranslationKey));
    }
  };

  const renderBoldText = (text: string) =>
    text.split("**").map((part, pi) =>
      pi % 2 === 1 ? <strong key={pi}>{part}</strong> : <span key={pi}>{part}</span>
    );

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "fixed bottom-6 right-4 sm:right-6 z-50 flex items-center justify-center h-14 w-14 rounded-full shadow-hero transition-all duration-300",
          open
            ? "bg-muted text-foreground rotate-0"
            : "bg-accent text-accent-foreground hover:scale-110"
        )}
        aria-label={open ? "Close MimmoAid" : "Open MimmoAid"}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        {!open && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-4 left-4 sm:left-auto sm:right-6 z-50 sm:w-[360px] max-h-[520px] rounded-2xl border border-border bg-card shadow-hero flex flex-col overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="gradient-hero px-4 py-3 text-primary-foreground">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif font-semibold text-sm">
                  {viewMode === "requests" ? t("aid.myRequests" as TranslationKey) : t("aid.title" as TranslationKey)}
                </h3>
                <p className="text-xs text-primary-foreground/70">
                  {viewMode === "requests" ? t("aid.yourRequests" as TranslationKey) : t("aid.subtitle" as TranslationKey)}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {businessTier && viewMode === "chat" && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary-foreground/20 text-primary-foreground border border-primary-foreground/20">
                    <Clock className="h-2.5 w-2.5" />
                    24h
                  </span>
                )}
                {businessTier && (
                  <button
                    onClick={() => {
                      setViewMode(viewMode === "chat" ? "requests" : "chat");
                      setExpandedRequest(null);
                    }}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-primary-foreground/15 hover:bg-primary-foreground/25 text-primary-foreground transition-colors"
                  >
                    {viewMode === "requests" ? (
                      <>
                        <ChevronLeft className="h-3 w-3" />
                        {t("aid.chat" as TranslationKey)}
                      </>
                    ) : (
                      <>
                        <Inbox className="h-3 w-3" />
                        {t("aid.requests" as TranslationKey)}
                        {unreadCount > 0 && (
                          <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold">
                            {unreadCount}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {viewMode === "requests" ? (
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px] max-h-[380px]">
              {requestsLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-sm">{t("aid.loadingRequests" as TranslationKey)}</span>
                </div>
              ) : supportRequests.length === 0 ? (
                <div className="text-center py-8">
                  <Inbox className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">{t("aid.noRequests" as TranslationKey)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("aid.noRequestsHint" as TranslationKey)}</p>
                </div>
              ) : (
                supportRequests.map((req: any) => {
                  const status = statusConfig[req.status] ?? statusConfig.open;
                  const StatusIcon = status.icon;
                  const isExpanded = expandedRequest === req.id;

                  return (
                    <button
                      key={req.id}
                      onClick={() => setExpandedRequest(isExpanded ? null : req.id)}
                      className={cn(
                        "w-full text-left rounded-xl border transition-all",
                        isExpanded ? "border-accent/40 bg-accent/5" : "border-border bg-card hover:bg-secondary/30",
                        !req.is_read_by_user && req.admin_response && "ring-2 ring-accent/30"
                      )}
                    >
                      <div className="px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-medium text-foreground line-clamp-1">{req.subject}</h4>
                          <span className={cn("shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full", status.className)}>
                            <StatusIcon className="h-2.5 w-2.5" />
                            {status.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(req.created_at), "PPP p", { locale: dateFnsLocale })}
                        </p>

                        {isExpanded && (
                          <div className="mt-2.5 space-y-2.5">
                            <div className="rounded-lg bg-secondary/40 px-3 py-2">
                              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{t("aid.yourMessage" as TranslationKey)}</p>
                              <p className="text-xs text-foreground whitespace-pre-wrap">{req.message}</p>
                            </div>
                            {req.admin_response ? (
                              <div className="rounded-lg bg-accent/10 border border-accent/20 px-3 py-2">
                                <p className="text-[10px] font-medium text-accent uppercase tracking-wider mb-1">{t("aid.adminResponse" as TranslationKey)}</p>
                                <p className="text-xs text-foreground whitespace-pre-wrap">{req.admin_response}</p>
                                {req.responded_at && (
                                  <p className="text-[10px] text-muted-foreground mt-1.5">
                                    {format(new Date(req.responded_at), "PPP p", { locale: dateFnsLocale })}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic px-1">{t("aid.awaitingResponse" as TranslationKey)}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px] max-h-[320px]">
                <div className="space-y-2">
                  {messages.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center mb-3">
                      {t("aid.askOrGuide" as TranslationKey)}
                    </p>
                  )}
                  {messages.length > 0 && (
                    <details className="group">
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none mb-2">
                        {t("aid.quickGuides" as TranslationKey)}
                      </summary>
                      <div className="space-y-1.5 pb-2 max-h-[180px] overflow-y-auto">
                        {quickGuides.map((g) => (
                          <button
                            key={g.q}
                            onClick={() => handleQuickGuide(g)}
                            className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 text-foreground transition-colors"
                          >
                            {g.q}
                          </button>
                        ))}
                      </div>
                    </details>
                  )}
                  {messages.length === 0 && (
                    <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
                      {quickGuides.map((g) => (
                        <button
                          key={g.q}
                          onClick={() => handleQuickGuide(g)}
                          className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 text-foreground transition-colors"
                        >
                          {g.q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "text-sm px-3 py-2 rounded-xl max-w-[85%]",
                      msg.role === "user"
                        ? "ml-auto bg-accent text-accent-foreground"
                        : "bg-secondary text-secondary-foreground"
                    )}
                  >
                    {renderBoldText(msg.content)}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2 text-muted-foreground text-xs px-3">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t("aid.thinking" as TranslationKey)}
                  </div>
                )}
              </div>

              {businessTier && (
                <div className="px-3 pt-1">
                  <button
                    onClick={() => setEscalateMode(!escalateMode)}
                    className={cn(
                      "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors",
                      escalateMode
                        ? "bg-accent/10 text-accent border-accent/30"
                        : "text-muted-foreground border-border hover:bg-secondary/50"
                    )}
                  >
                    <Flag className="h-3 w-3" />
                    {escalateMode ? t("aid.cancelRequest" as TranslationKey) : t("aid.submitRequest" as TranslationKey)}
                  </button>
                </div>
              )}

              <div className="border-t border-border p-3">
                {escalateMode ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={escalateSubject}
                      onChange={(e) => setEscalateSubject(e.target.value)}
                      placeholder={t("aid.subjectPlaceholder" as TranslationKey)}
                      className="w-full text-sm bg-secondary/30 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={t("aid.messagePlaceholder" as TranslationKey)}
                      rows={3}
                      className="w-full text-sm bg-secondary/30 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                    />
                    <Button
                      size="sm"
                      onClick={handleEscalate}
                      disabled={!escalateSubject.trim() || !input.trim()}
                      className="w-full gap-1.5"
                    >
                      <Flag className="h-3.5 w-3.5" />
                      {t("aid.submitToAdmin" as TranslationKey)}
                    </Button>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSend();
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={t("aid.typePlaceholder" as TranslationKey)}
                      className="flex-1 text-sm bg-secondary/30 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      disabled={isLoading}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant="default"
                      disabled={!input.trim() || isLoading}
                      className="shrink-0"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default SupportChatWidget;
