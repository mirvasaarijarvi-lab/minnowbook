import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, Flag, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-chat`;

interface SupportChatWidgetProps {
  /** If true, user can escalate requests to admin */
  businessTier?: boolean;
}

const quickGuides = [
  { q: "How do I manage reservations?", a: "Go to your **Dashboard → Reservations** to view, filter, edit, and manage all bookings. You can confirm or cancel reservations from the action menu on each card." },
  { q: "How do I customize my booking page?", a: "Navigate to **Settings** in your dashboard. Upload your logo, set brand colors, and add a hero image. Your public booking page updates automatically." },
  { q: "How do I set up email templates?", a: "In **Settings → Email Templates**, you can customize both confirmation and cancellation emails. Use the preview tab to see how they'll look to guests." },
  { q: "How do I add staff members?", a: "Go to **Admin → Users** to invite new staff. You can set roles (Owner, Admin, Staff) and approve or remove team members." },
  { q: "How do I add or edit resources?", a: "Go to **Dashboard → Resources** to create rooms, tables, or venues. You can set capacity, pricing, upload up to 5 images, and toggle active/inactive status." },
  { q: "How do I set opening hours?", a: "In **Settings → Opening Hours**, configure open/close times for each day of the week per resource type. Mark days as closed when needed." },
  { q: "How do I view reports?", a: "Navigate to **Dashboard → Reports** to see reservation trends, occupancy rates, and revenue summaries. You can filter by date range and export printable reports." },
  { q: "How does pricing work for rooms?", a: "Set a **base price per night** on each resource, then configure **room type multipliers** (Single 1.0×, Double 1.5×, Suite 2.5×, etc.). The booking page calculates totals automatically." },
  { q: "How do I share my booking link?", a: "Your public booking link is shown on the **Dashboard Overview**. Click **Copy link** to copy it, or open it in a new tab to preview. Share it on your website or social media." },
  { q: "How do I block dates or time slots?", a: "In **Dashboard → Calendar**, click on a date and use the **Block Slot** option to prevent bookings for specific dates, times, or resources." },
];

const SupportChatWidget = ({ businessTier = false }: SupportChatWidgetProps) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [escalateMode, setEscalateMode] = useState(false);
  const [escalateSubject, setEscalateSubject] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { session } = useAuth();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  // Query unread support request responses for Business tier users
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
    refetchInterval: 30000, // poll every 30s
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

  // When chat opens, mark responses as read
  useEffect(() => {
    if (open && unreadCount > 0) {
      markResponsesRead();
    }
  }, [open]);

  const handleQuickGuide = (guide: typeof quickGuides[0]) => {
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
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      };
      // Pass user's auth token if available
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const resp = await fetch(CHAT_URL, {
        method: "POST",
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
        { role: "assistant", content: "Sorry, I couldn't connect. Please try again." },
      ]);
    }

    setIsLoading(false);
  }, [messages, session]);

  const handleSend = () => {
    if (!input.trim()) return;
    const msg = input.trim();
    setInput("");
    sendAI(msg);
  };

  const handleEscalate = async () => {
    if (!escalateSubject.trim() || !input.trim()) return;
    if (!tenantId) {
      toast.error("Unable to submit request — no tenant found.");
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

      setMessages((prev) => [
        ...prev,
        { role: "user", content: `📋 **Support Request:** ${escalateSubject.trim()}\n${input.trim()}` },
        { role: "assistant", content: "Your support request has been submitted! Your admin team will review it and respond soon. You'll see a notification when it's been addressed." },
      ]);
      setInput("");
      setEscalateSubject("");
      setEscalateMode(false);
      toast.success("Support request submitted");
    } catch (e: any) {
      toast.error(e.message || "Failed to submit request");
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center justify-center h-14 w-14 rounded-full shadow-hero transition-all duration-300",
          open
            ? "bg-muted text-foreground rotate-0"
            : "bg-accent text-accent-foreground hover:scale-110"
        )}
        aria-label={open ? "Close support chat" : "Open support chat"}
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
        <div className="fixed bottom-24 right-6 z-50 w-[360px] max-h-[520px] rounded-2xl border border-border bg-card shadow-hero flex flex-col overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="gradient-hero px-4 py-3 text-primary-foreground">
            <h3 className="font-serif font-semibold text-sm">AI Support</h3>
            <p className="text-xs text-primary-foreground/70">Ask anything about MinnowBook</p>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px] max-h-[320px]">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground text-center mb-3">
                  Ask a question or try a quick guide:
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
                Thinking...
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
                {escalateMode ? "Cancel request" : "Submit support request"}
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
                  placeholder="Subject (e.g. Feature request)"
                  className="w-full text-sm bg-secondary/30 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Describe your request or suggestion..."
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
                  Submit to Admin
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
                  placeholder="Type your question..."
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
        </div>
      )}
    </>
  );
};

export default SupportChatWidget;
