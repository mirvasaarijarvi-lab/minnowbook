import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  CalendarDays,
  Mail,
  Settings,
  Users,
  CreditCard,
  HelpCircle,
  BookOpen,
  Palette,
  Clock,
  Send,
  Loader2,
  Flag,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import { useT } from "@/contexts/I18nContext";
import { TranslationKey } from "@/i18n/translations";
import { useTierGate } from "@/hooks/useTierGate";

interface GuideArticle {
  titleKey: string;
  descKey: string;
  icon: React.ElementType;
  contentKeys: string[];
}

const articleDefs: GuideArticle[] = [
  { titleKey: "help.art1Title", descKey: "help.art1Desc", icon: BookOpen, contentKeys: ["help.art1C1", "help.art1C2", "help.art1C3", "help.art1C4"] },
  { titleKey: "help.art2Title", descKey: "help.art2Desc", icon: CalendarDays, contentKeys: ["help.art2C1", "help.art2C2", "help.art2C3", "help.art2C4"] },
  { titleKey: "help.art3Title", descKey: "help.art3Desc", icon: Mail, contentKeys: ["help.art3C1", "help.art3C2", "help.art3C3", "help.art3C4"] },
  { titleKey: "help.art4Title", descKey: "help.art4Desc", icon: Palette, contentKeys: ["help.art4C1", "help.art4C2", "help.art4C3", "help.art4C4"] },
  { titleKey: "help.art5Title", descKey: "help.art5Desc", icon: Clock, contentKeys: ["help.art5C1", "help.art5C2", "help.art5C3", "help.art5C4"] },
  { titleKey: "help.art6Title", descKey: "help.art6Desc", icon: Settings, contentKeys: ["help.art6C1", "help.art6C2", "help.art6C3", "help.art6C4"] },
  { titleKey: "help.art7Title", descKey: "help.art7Desc", icon: Users, contentKeys: ["help.art7C1", "help.art7C2", "help.art7C3", "help.art7C4"] },
  { titleKey: "help.art8Title", descKey: "help.art8Desc", icon: CreditCard, contentKeys: ["help.art8C1", "help.art8C2", "help.art8C3", "help.art8C4"] },
  { titleKey: "help.art9Title", descKey: "help.art9Desc", icon: HelpCircle, contentKeys: ["help.art9C1", "help.art9C2", "help.art9C3", "help.art9C4"] },
  { titleKey: "help.art10Title", descKey: "help.art10Desc", icon: Sparkles, contentKeys: ["help.art10C1", "help.art10C2", "help.art10C3", "help.art10C4"] },
];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-chat`;

const GUIDE_KEYS = [1, 2, 3, 4, 5, 6] as const;

const DashboardSupportPanel = () => {
  const t = useT();
  const [search, setSearch] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [escalateMode, setEscalateMode] = useState(false);
  const [escalateSubject, setEscalateSubject] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { session } = useAuth();
  const { tenantId, tenant } = useTenant();
  const { isMultiSite: businessTier } = useTierGate();

  const filtered = useMemo(() => {
    if (!search.trim()) return articleDefs;
    const q = search.toLowerCase();
    return articleDefs.filter(
      (a) =>
        t(a.titleKey as TranslationKey).toLowerCase().includes(q) ||
        t(a.descKey as TranslationKey).toLowerCase().includes(q) ||
        a.contentKeys.some((c) => t(c as TranslationKey).toLowerCase().includes(q))
    );
  }, [search, t]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages]);

  const quickGuides = GUIDE_KEYS.map((n) => ({
    q: t(`help.guide${n}Q` as TranslationKey),
    a: t(`help.guide${n}A` as TranslationKey),
  }));

  const handleQuickGuide = (guide: (typeof quickGuides)[0]) => {
    setChatMessages((prev) => [
      ...prev,
      { role: "user", content: guide.q },
      { role: "assistant", content: guide.a },
    ]);
  };

  const sendAI = useCallback(
    async (userMessage: string) => {
      const userMsg: ChatMessage = { role: "user", content: userMessage };
      setChatMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      let assistantSoFar = "";
      const allMessages = [...chatMessages, userMsg];

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        };
        if (session?.access_token) {
          headers["Authorization"] = `Bearer ${session.access_token}`;
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
          const err = await resp.json().catch(() => ({ error: t("help.errorConnect" as TranslationKey) }));
          setChatMessages((prev) => [
            ...prev,
            { role: "assistant", content: err.error || t("help.errorConnect" as TranslationKey) },
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
                setChatMessages((prev) => {
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
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: t("help.errorConnect" as TranslationKey) },
        ]);
      }

      setIsLoading(false);
    },
    [chatMessages, session, t]
  );

  const handleSend = () => {
    if (!chatInput.trim()) return;
    const msg = chatInput.trim();
    setChatInput("");
    sendAI(msg);
  };

  const handleEscalate = async () => {
    if (!escalateSubject.trim() || !chatInput.trim()) return;
    if (!tenantId) {
      toast.error(t("help.errorNoTenant" as TranslationKey));
      return;
    }

    try {
      const { error } = await supabase.from("support_requests").insert({
        tenant_id: tenantId,
        user_id: session?.user?.id,
        subject: escalateSubject.trim(),
        message: chatInput.trim(),
      });
      if (error) throw error;

      setChatMessages((prev) => [
        ...prev,
        { role: "user", content: `📋 **${t("help.requestSubmitted" as TranslationKey)}:** ${escalateSubject.trim()}\n${chatInput.trim()}` },
        { role: "assistant", content: t("help.requestSubmittedDetail" as TranslationKey) },
      ]);
      setChatInput("");
      setEscalateSubject("");
      setEscalateMode(false);
      toast.success(t("help.successSubmit" as TranslationKey));
    } catch (e: any) {
      toast.error(e.message || t("help.errorSubmit" as TranslationKey));
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-serif font-bold text-foreground mb-1">{t("help.title" as TranslationKey)}</h2>
        <p className="text-muted-foreground text-sm">{t("help.subtitle" as TranslationKey)}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* FAQ Section */}
        <div className="xl:col-span-2 space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("help.searchPlaceholder" as TranslationKey)}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              {t("help.noResults" as TranslationKey)}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map((article) => {
                const Icon = article.icon;
                return (
                  <details
                    key={article.titleKey}
                    className="group rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                  >
                    <summary className="flex items-start gap-3 p-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                        <Icon className="h-4 w-4 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-sm leading-tight">
                          {t(article.titleKey as TranslationKey)}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t(article.descKey as TranslationKey)}
                        </p>
                      </div>
                    </summary>
                    <div className="px-4 pb-4 pt-0 animate-fade-in">
                      <ul className="space-y-1.5 ml-12">
                        {article.contentKeys.map((key, i) => (
                          <li key={i} className="text-xs text-foreground/80 leading-relaxed flex items-start gap-1.5">
                            <span className="text-accent mt-0.5">•</span>
                            {t(key as TranslationKey)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </div>

        {/* AI Chat Section */}
        <div className="xl:col-span-1">
          <div className="rounded-xl border border-border bg-card shadow-sm flex flex-col h-[560px] overflow-hidden sticky top-8">
            <div className="gradient-hero px-4 py-3 text-primary-foreground">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif font-semibold text-sm">{t("help.aiTitle" as TranslationKey)}</h3>
                  <p className="text-xs text-primary-foreground/70">{t("help.aiSubtitle" as TranslationKey)}</p>
                </div>
                {businessTier && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary-foreground/20 text-primary-foreground border border-primary-foreground/20">
                    <Clock className="h-2.5 w-2.5" />
                    24h
                  </span>
                )}
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.length === 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground text-center mb-3">
                    {t("help.askOrGuide" as TranslationKey)}
                  </p>
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

              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "text-sm px-3 py-2 rounded-xl max-w-[85%]",
                    msg.role === "user"
                      ? "ml-auto bg-accent text-accent-foreground"
                      : "bg-secondary text-secondary-foreground"
                  )}
                >
                  {msg.content.split("**").map((part, pi) =>
                    pi % 2 === 1 ? (
                      <strong key={pi}>{part}</strong>
                    ) : (
                      <span key={pi}>{part}</span>
                    )
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex items-center gap-2 text-muted-foreground text-xs px-3">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t("help.thinking" as TranslationKey)}
                </div>
              )}
            </div>

            {/* Escalate toggle for Business tier */}
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
                  {escalateMode ? t("help.cancelRequest" as TranslationKey) : t("help.submitRequest" as TranslationKey)}
                </button>
              </div>
            )}

            {/* Input */}
            <div className="border-t border-border p-3">
              {escalateMode ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={escalateSubject}
                    onChange={(e) => setEscalateSubject(e.target.value)}
                    placeholder={t("help.subjectPlaceholder" as TranslationKey)}
                    className="w-full text-sm bg-secondary/30 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={t("help.describePlaceholder" as TranslationKey)}
                    rows={2}
                    className="w-full text-sm bg-secondary/30 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  />
                  <Button
                    size="sm"
                    onClick={handleEscalate}
                    disabled={!escalateSubject.trim() || !chatInput.trim()}
                    className="w-full gap-1.5"
                  >
                    <Flag className="h-3.5 w-3.5" />
                    {t("help.submitToAdmin" as TranslationKey)}
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
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={t("help.typePlaceholder" as TranslationKey)}
                    className="flex-1 text-sm bg-secondary/30 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    disabled={isLoading}
                  />
                  <Button type="submit" size="sm" variant="default" disabled={!chatInput.trim() || isLoading} className="shrink-0">
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardSupportPanel;
