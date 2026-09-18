import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, MapPin, Mail, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import {
  createAccessibleChallenge,
  isChallengePassed,
  type AccessibleChallenge,
} from "@/lib/accessibleChallenge";


/**
 * The support address is never written as a complete string in the markup or
 * the bundle, so address-harvesting crawlers cannot scrape it from the page.
 * It is assembled at runtime only when the visitor asks for it.
 */
const SUPPORT_ADDRESS_PARTS = ["support", "mimmobook", "com"] as const;
const supportAddress = () =>
  `${SUPPORT_ADDRESS_PARTS[0]}@${SUPPORT_ADDRESS_PARTS[1]}.${SUPPORT_ADDRESS_PARTS[2]}`;

// Anti-abuse limits. Kept deliberately generous for real people.
const MIN_FILL_SECONDS = 3;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_SUBMITS = 3;
const RATE_STORAGE_KEY = "mimmobook-support-submits";
// From this many recent messages onwards, a text challenge is required.
const CHALLENGE_AFTER_SUBMITS = 2;


const contactSchema = z.object({
  name: z.string().trim().max(100, "Name must be under 100 characters."),
  email: z
    .string()
    .trim()
    .min(1, "Please add your email so we can reply.")
    .email("Please check the email address.")
    .max(255, "Email must be under 255 characters."),
  subject: z
    .string()
    .trim()
    .min(3, "Please add a short subject.")
    .max(150, "Subject must be under 150 characters."),
  message: z
    .string()
    .trim()
    .min(15, "Please describe your question in a bit more detail.")
    .max(4000, "Message must be under 4000 characters."),
});

const readSubmitTimes = (): number[] => {
  try {
    const raw = localStorage.getItem(RATE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - RATE_WINDOW_MS;
    return parsed.filter((t: unknown) => typeof t === "number" && t > cutoff);
  } catch {
    return [];
  }
};

const recordSubmit = (times: number[]) => {
  try {
    localStorage.setItem(RATE_STORAGE_KEY, JSON.stringify([...times, Date.now()]));
  } catch {
    /* storage unavailable, limit simply not persisted */
  }
};

const AREA_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  superadmin: "Superadmin area",
  generic: "General",
};

/**
 * Contact form rendered on the /support page. Reads `area`, `from`, and
 * `email` query params (set by NoTenantState) to prefill the form. When the
 * user has an active tenant, the message is logged via `support_requests`.
 * Otherwise (signed out, or signed in without a tenant) it falls back to a
 * `mailto:` link built at click time so the address is never in the markup.
 */
const SupportContactForm = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const sectionRef = useRef<HTMLDivElement>(null);
  const mountedAtRef = useRef<number>(Date.now());

  const area = searchParams.get("area") ?? "generic";
  const fromPath = searchParams.get("from");
  const prefillEmail = searchParams.get("email");
  const shouldFocus = searchParams.get("contact") === "1";
  const areaLabel = AREA_LABELS[area] ?? "General";

  const defaultSubject = useMemo(() => {
    if (area === "dashboard") return "Help accessing my dashboard";
    if (area === "superadmin") return "Help accessing the superadmin area";
    return "Support request";
  }, [area]);

  const defaultMessage = useMemo(() => {
    const lines: string[] = [];
    lines.push("Hi MimmoBook team,");
    lines.push("");
    if (fromPath) {
      lines.push(`I was trying to reach: ${fromPath}`);
    }
    if (area !== "generic") {
      lines.push(`Area: ${areaLabel}`);
    }
    lines.push("");
    lines.push("Please describe what happened:");
    lines.push("");
    return lines.join("\n");
  }, [area, areaLabel, fromPath]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState(defaultMessage);
  const [submitting, setSubmitting] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [revealedAddress, setRevealedAddress] = useState<string | null>(null);

  // Initial prefill — runs when auth resolves or query params change.
  useEffect(() => {
    setEmail((current) => current || prefillEmail || user?.email || "");
    setName((current) =>
      current || (user?.user_metadata?.display_name as string | undefined) || ""
    );
  }, [prefillEmail, user?.email, user?.user_metadata?.display_name]);

  // Keep subject/message in sync if the user navigates here from a different
  // area without having edited the fields yet.
  useEffect(() => {
    setSubject((current) => (current === "" || current === "Support request" ? defaultSubject : current));
  }, [defaultSubject]);

  useEffect(() => {
    setMessage((current) => (current.trim() === "" ? defaultMessage : current));
  }, [defaultMessage]);

  // Auto-scroll + focus the form when the user arrives via a deep link with
  // ?contact=1 (the CTA from NoTenantState always sets this).
  useEffect(() => {
    if (!shouldFocus) return;
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [shouldFocus]);

  const openMailto = () => {
    const address = supportAddress();
    setRevealedAddress(address);
    const body = `${message}\n\n— Sent from ${window.location.origin}/support`;
    window.location.href = `mailto:${address}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Hidden field only bots fill in. Behave like a normal success so the bot
    // gets no signal, but send nothing.
    if (honeypot.trim() !== "") {
      toast.success("Support request sent", {
        description: "Our team will get back to you by email.",
      });
      return;
    }

    if ((Date.now() - mountedAtRef.current) / 1000 < MIN_FILL_SECONDS) {
      toast.error("Please take a moment to review your message before sending.");
      return;
    }

    const parsed = contactSchema.safeParse({ name, email, subject, message });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }

    const recent = readSubmitTimes();
    if (recent.length >= RATE_MAX_SUBMITS) {
      toast.error("You have sent several messages already", {
        description: "Please wait a few minutes before sending another one.",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Authenticated + has a tenant: log to support_requests so admins/superadmins
      // can pick it up from the dashboard. Otherwise fall back to mailto.
      if (user?.id && tenantId) {
        const clean = parsed.data;
        const annotated =
          `${clean.message}\n\n---\nReply-to: ${clean.email}\nName: ${clean.name || "(not provided)"}\n` +
          `Area: ${areaLabel}${fromPath ? `\nAttempted route: ${fromPath}` : ""}`;
        const { error } = await supabase.from("support_requests").insert({
          tenant_id: tenantId,
          user_id: user.id,
          subject: clean.subject,
          message: annotated,
        });
        if (error) throw error;
        recordSubmit(recent);
        toast.success("Support request sent", {
          description: "Our team will get back to you by email.",
        });
        setMessage(defaultMessage);
      } else {
        recordSubmit(recent);
        openMailto();
        toast.info("Opening your email app…", {
          description: "If nothing happens, use the show address button below.",
        });
      }
    } catch (err: any) {
      toast.error("Couldn't send the request", {
        description: err?.message ?? "Please try again in a moment.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div ref={sectionRef} id="contact" className="container mx-auto px-4">
      <Card className="max-w-2xl mx-auto border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="font-serif text-xl">Contact support</CardTitle>
            {area !== "generic" && (
              <Badge variant="secondary" className="gap-1.5">
                <MapPin className="h-3 w-3" />
                {areaLabel}
              </Badge>
            )}
          </div>
          <CardDescription>
            Send us a message and we'll reply by email. Response time is typically within one
            business day. We use your details only to answer your request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fromPath && (
            <div className="mb-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground flex items-start gap-2">
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
              <div className="min-w-0">
                <div>Reported route</div>
                <code className="block font-mono text-foreground break-all mt-0.5">
                  {fromPath}
                </code>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Honeypot: hidden from people and assistive tech, bots fill it. */}
            <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
              <label htmlFor="support-company-website">Company website</label>
              <input
                id="support-company-website"
                name="company_website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="support-name">Your name</Label>
                <Input
                  id="support-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Optional"
                  autoComplete="name"
                  maxLength={100}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="support-email">Email *</Label>
                <Input
                  id="support-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  maxLength={255}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="support-subject">Subject *</Label>
              <Input
                id="support-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                maxLength={150}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="support-message">Message *</Label>
              <Textarea
                id="support-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                required
                maxLength={4000}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button type="submit" disabled={submitting} className="gap-1.5 flex-1">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send to support
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 flex-1"
                onClick={openMailto}
              >
                <Mail className="h-4 w-4" />
                Email instead
              </Button>
            </div>

            <div className="pt-2 text-xs text-muted-foreground flex items-start gap-2">
              <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" aria-hidden="true" />
              <p>
                Our support address is hidden from automated crawlers.{" "}
                {revealedAddress ? (
                  <span className="text-foreground font-medium">{revealedAddress}</span>
                ) : (
                  <button
                    type="button"
                    className="underline underline-offset-2 text-foreground hover:text-primary"
                    onClick={() => setRevealedAddress(supportAddress())}
                  >
                    Show the address
                  </button>
                )}
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupportContactForm;
