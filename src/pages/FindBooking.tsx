import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MailCheck, Search } from "lucide-react";
import Logo from "@/components/Logo";
import SEOHead from "@/components/SEOHead";
import { toast } from "sonner";
import { useLanguage, useT } from "@/contexts/I18nContext";

const FindBooking = () => {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const { language } = useLanguage();
  const t = useT();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error(t("guest.find.invalidEmail"));
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("guest-booking-portal", {
        body: {
          action: "lookup",
          email: email.trim(),
          language,
          origin: window.location.origin,
        },
      });
      if (error) throw error;
      setSent(true);
    } catch {
      toast.error(t("guest.find.error"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Find your booking | MimmoBook"
        description="Enter your email to receive a secure link to view, change, or cancel your upcoming reservation."
        path="/find-booking"
        type="website"
      />
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Logo variant="color" size="sm" />
          <span className="text-sm text-muted-foreground">{t("guest.portal.label")}</span>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 sm:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-xl flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              {t("guest.find.heading")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-3 text-center py-4">
                <MailCheck className="h-10 w-10 text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">{t("guest.find.sentBody")}</p>
                <Button variant="outline" onClick={() => { setSent(false); setEmail(""); }}>
                  {t("guest.find.useAnother")}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-muted-foreground">{t("guest.find.intro")}</p>
                <div className="space-y-2">
                  <Label htmlFor="find-booking-email">{t("guest.find.emailLabel")}</Label>
                  <Input
                    id="find-booking-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={sending}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {t("guest.find.submit")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default FindBooking;
