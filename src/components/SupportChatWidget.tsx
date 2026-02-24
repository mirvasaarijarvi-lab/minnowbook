import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-chat`;

interface SupportChatWidgetProps {
  /** If true, messages go through AI. Otherwise it's a static guide. */
  aiEnabled?: boolean;
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

const SupportChatWidget = ({ aiEnabled = false }: SupportChatWidgetProps) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

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
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
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
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    const msg = input.trim();
    setInput("");

    if (aiEnabled) {
      sendAI(msg);
    } else {
      // Static mode: show a helpful fallback
      setMessages((prev) => [
        ...prev,
        { role: "user", content: msg },
        {
          role: "assistant",
          content:
            "Thanks for your question! Browse the quick guides below, or visit our [Support page](/support) for more help. **Business plan** customers get AI-powered answers right here in the dashboard.",
        },
      ]);
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
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[360px] max-h-[520px] rounded-2xl border border-border bg-card shadow-hero flex flex-col overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="gradient-hero px-4 py-3 text-primary-foreground">
            <h3 className="font-serif font-semibold text-sm">
              {aiEnabled ? "AI Support" : "Support Guide"}
            </h3>
            <p className="text-xs text-primary-foreground/70">
              {aiEnabled ? "Ask anything about MinnowBook" : "Quick guides & help"}
            </p>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px] max-h-[320px]">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground text-center mb-3">
                  {aiEnabled ? "Ask a question or try a quick guide:" : "Select a quick guide:"}
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

          {/* Input */}
          <div className="border-t border-border p-3">
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
                placeholder={aiEnabled ? "Type your question..." : "Ask a question..."}
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
          </div>
        </div>
      )}
    </>
  );
};

export default SupportChatWidget;
