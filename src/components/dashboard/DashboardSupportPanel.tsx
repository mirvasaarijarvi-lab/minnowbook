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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";

interface GuideArticle {
  title: string;
  description: string;
  icon: React.ElementType;
  category: string;
  content: string[];
}

const articles: GuideArticle[] = [
  {
    title: "Getting Started",
    description: "Set up your account and create your first booking page in minutes.",
    icon: BookOpen,
    category: "Basics",
    content: [
      "Sign up for a free 30-day trial — no credit card needed.",
      "Complete the onboarding wizard to name your business and choose your reservation types.",
      "Customize your branding (logo, colors) in Settings.",
      "Share your booking link with customers!",
    ],
  },
  {
    title: "Managing Reservations",
    description: "View, edit, confirm, and cancel reservations from your dashboard.",
    icon: CalendarDays,
    category: "Reservations",
    content: [
      "Use the Calendar view for a visual overview of upcoming bookings.",
      "Switch to the List view to filter by status, type, or date range.",
      "Click any reservation to edit details, add notes, or change status.",
      "Confirmation and cancellation emails are sent automatically.",
    ],
  },
  {
    title: "Email Templates",
    description: "Customize confirmation and cancellation emails sent to guests.",
    icon: Mail,
    category: "Communication",
    content: [
      "Go to Settings → Email Templates to customize your emails.",
      "Preview how emails look before sending using the built-in preview.",
      "Add custom messages per reservation when confirming or cancelling.",
      "Emails support multi-language content (EN, FI, SV).",
    ],
  },
  {
    title: "Branding & Booking Page",
    description: "Customize your public booking page with your brand identity.",
    icon: Palette,
    category: "Customization",
    content: [
      "Upload your logo and set primary/accent colors in Settings.",
      "Add a hero image for your booking page header.",
      "Your booking page is available at /book/your-slug.",
      "Business description appears on the booking page for guests.",
    ],
  },
  {
    title: "Opening Hours",
    description: "Configure when your business accepts bookings for each type.",
    icon: Clock,
    category: "Configuration",
    content: [
      "Set opening hours per reservation type (restaurant, venue, hotel).",
      "Mark specific days as closed.",
      "Opening hours determine available time slots on the booking page.",
      "Use blocked slots to temporarily close specific dates.",
    ],
  },
  {
    title: "Resources & Rooms",
    description: "Manage rooms, tables, and event spaces that can be booked.",
    icon: Settings,
    category: "Configuration",
    content: [
      "Add resources in the Resources section of your dashboard.",
      "Set capacity, pricing, and descriptions for each resource.",
      "Upload photos to showcase your spaces on the booking page.",
      "Deactivate resources to temporarily hide them from bookings.",
    ],
  },
  {
    title: "Staff & User Management",
    description: "Invite team members and manage roles and permissions.",
    icon: Users,
    category: "Team",
    content: [
      "Owners can invite staff via the Admin panel.",
      "Roles: Owner (full access), Admin (manage resources), Staff (view reservations).",
      "Approve or remove team members at any time.",
      "Each plan has a staff user limit — upgrade to add more.",
    ],
  },
  {
    title: "Plans & Billing",
    description: "Understand pricing tiers and manage your subscription.",
    icon: CreditCard,
    category: "Billing",
    content: [
      "Basic (€29/mo) — 1 type, 1–3 staff, default templates.",
      "Pro (€79/mo) — 1 type, 10 staff, custom templates, analytics.",
      "Business (€199/mo) — All types, unlimited staff, dedicated support, AI chat.",
      "Upgrade or downgrade anytime. Changes take effect next billing cycle.",
    ],
  },
  {
    title: "Frequently Asked Questions",
    description: "Answers to the most common questions about MinnowBook.",
    icon: HelpCircle,
    category: "FAQ",
    content: [
      "Q: Do I need a credit card for the trial? A: No!",
      "Q: Can I use my own domain? A: Custom domains are on our roadmap.",
      "Q: How do guests receive confirmations? A: Automatically via email when you confirm a booking.",
      "Q: Can I export my data? A: Yes, reports can be exported from the Reports panel.",
    ],
  },
];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-chat`;

const quickGuides = [
  { q: "How do I manage reservations?", a: "Go to your **Dashboard → Reservations** to view, filter, edit, and manage all bookings. You can confirm or cancel reservations from the action menu on each card." },
  { q: "How do I customize my booking page?", a: "Navigate to **Settings** in your dashboard. Upload your logo, set brand colors, and add a hero image. Your public booking page updates automatically." },
  { q: "How do I set up email templates?", a: "In **Settings → Email Templates**, you can customize both confirmation and cancellation emails. Use the preview tab to see how they'll look to guests." },
  { q: "How do I add staff members?", a: "Go to **Admin → Users** to invite new staff. You can set roles (Owner, Admin, Staff) and approve or remove team members." },
  { q: "How do I add or edit resources?", a: "Go to **Dashboard → Resources** to create rooms, tables, or venues. You can set capacity, pricing, upload up to 5 images, and toggle active/inactive status." },
];

const DashboardSupportPanel = () => {
  const [search, setSearch] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [escalateMode, setEscalateMode] = useState(false);
  const [escalateSubject, setEscalateSubject] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { session } = useAuth();
  const { tenantId, tenant } = useTenant();
  const businessTier = tenant?.tier === "business";

  const filtered = useMemo(() => {
    if (!search.trim()) return articles;
    const q = search.toLowerCase();
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.content.some((c) => c.toLowerCase().includes(q))
    );
  }, [search]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages]);

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
          headers,
          body: JSON.stringify({ messages: allMessages }),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: "Something went wrong." }));
          setChatMessages((prev) => [
            ...prev,
            { role: "assistant", content: err.error || "Sorry, something went wrong." },
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
          { role: "assistant", content: "Sorry, I couldn't connect. Please try again." },
        ]);
      }

      setIsLoading(false);
    },
    [chatMessages, session]
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
      toast.error("Unable to submit request — no tenant found.");
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
        { role: "user", content: `📋 **Support Request:** ${escalateSubject.trim()}\n${chatInput.trim()}` },
        { role: "assistant", content: "Your support request has been submitted! Your admin team will review it and respond soon." },
      ]);
      setChatInput("");
      setEscalateSubject("");
      setEscalateMode(false);
      toast.success("Support request submitted");
    } catch (e: any) {
      toast.error(e.message || "Failed to submit request");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-serif font-bold text-foreground mb-1">Help & Support</h2>
        <p className="text-muted-foreground text-sm">Browse guides, FAQs, and ask the AI assistant.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* FAQ Section */}
        <div className="xl:col-span-2 space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for help..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              No results found. Try a different search term.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map((article) => {
                const Icon = article.icon;
                return (
                  <details
                    key={article.title}
                    className="group rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                  >
                    <summary className="flex items-start gap-3 p-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                        <Icon className="h-4 w-4 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-sm leading-tight">
                          {article.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {article.description}
                        </p>
                      </div>
                    </summary>
                    <div className="px-4 pb-4 pt-0 animate-fade-in">
                      <ul className="space-y-1.5 ml-12">
                        {article.content.map((item, i) => (
                          <li key={i} className="text-xs text-foreground/80 leading-relaxed flex items-start gap-1.5">
                            <span className="text-accent mt-0.5">•</span>
                            {item}
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
              <h3 className="font-serif font-semibold text-sm">AI Support</h3>
              <p className="text-xs text-primary-foreground/70">Ask anything about MinnowBook</p>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.length === 0 && (
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
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Describe your request..."
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
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type your question..."
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
