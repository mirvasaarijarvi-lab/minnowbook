import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, MapPin, Mail, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";

const SUPPORT_EMAIL = "support@mimmobook.com";

const AREA_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  superadmin: "Superadmin area",
  generic: "General",
};

/**
 * Contact form rendered on the /support page. Reads `area`, `from`, and
 * `email` query params (set by NoTenantState) to prefill the form. When the
 * user has an active tenant, the message is logged via `support_requests`.
 * Otherwise (signed out, or signed in without a tenant — the common case for
 * the NoTenantState CTA) it falls back to a `mailto:` link so the user can
 * still reach support.
 */
const SupportContactForm = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const sectionRef = useRef<HTMLDivElement>(null);

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

  const buildMailto = () => {
    const body = `${message}\n\n— Sent from ${window.location.origin}/support`;
    return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !subject.trim() || !message.trim()) {
      toast.error("Please fill in your email, subject, and message.");
      return;
    }
    setSubmitting(true);
    try {
      // Authenticated + has a tenant: log to support_requests so admins/superadmins
      // can pick it up from the dashboard. Otherwise fall back to mailto.
      if (user?.id && tenantId) {
        const annotated =
          `${message}\n\n---\nReply-to: ${email}\nName: ${name || "(not provided)"}\n` +
          `Area: ${areaLabel}${fromPath ? `\nAttempted route: ${fromPath}` : ""}`;
        const { error } = await supabase.from("support_requests").insert({
          tenant_id: tenantId,
          user_id: user.id,
          subject,
          message: annotated,
        });
        if (error) throw error;
        toast.success("Support request sent", {
          description: "Our team will get back to you by email.",
        });
        setMessage(defaultMessage);
      } else {
        // No tenant context — open mailto so the user can still reach us.
        window.location.href = buildMailto();
        toast.info("Opening your email app…", {
          description: `If nothing happens, write to ${SUPPORT_EMAIL}.`,
        });
      }
    } catch (err: any) {
      toast.error("Couldn't send the request", {
        description: err?.message ?? `Please email ${SUPPORT_EMAIL} directly.`,
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
            business day.
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
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="support-name">Your name</Label>
                <Input
                  id="support-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Optional"
                  autoComplete="name"
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
                asChild
                className="gap-1.5 flex-1"
              >
                <a href={buildMailto()}>
                  <Mail className="h-4 w-4" />
                  Email instead
                </a>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupportContactForm;
