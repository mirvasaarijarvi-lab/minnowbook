import { useEffect, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type GuestOffer = {
  business_name: string | null;
  guest_name: string;
  event_date: string;
  start_time: string;
  end_time: string | null;
  guests_count: number;
  event_space: string;
  event_type: string | null;
  menu: string | null;
  special_requests: string | null;
  invoicing_details: string | null;
  expires_on: string | null;
  language: string;
  status: string;
  guest_accepted_at: string | null;
  expired: boolean;
};

const TXT = {
  en: {
    title: "Your offer",
    from: "Offer from",
    hello: "Hello",
    date: "Date",
    time: "Time",
    guests: "Guests",
    space: "Space",
    type: "Event",
    menu: "Menu",
    requests: "Your requests",
    invoicing: "Invoicing details",
    validUntil: "Valid until",
    note: "Message to the business (optional)",
    accept: "Accept offer",
    accepting: "Accepting...",
    accepted: "Thank you, you have accepted this offer. The business will confirm your booking.",
    expired: "This offer has expired. Please contact the business for a new one.",
    closed: "This offer can no longer be accepted online. Please contact the business.",
    notFound: "This link is not valid. Please check the link in your email.",
    error: "Something went wrong. Please try again.",
    consent: "By accepting you agree to the offer as described above.",
  },
  fi: {
    title: "Tarjouksesi",
    from: "Tarjouksen lähettäjä",
    hello: "Hei",
    date: "Päivä",
    time: "Aika",
    guests: "Vieraat",
    space: "Tila",
    type: "Tilaisuus",
    menu: "Menu",
    requests: "Toiveesi",
    invoicing: "Laskutustiedot",
    validUntil: "Voimassa asti",
    note: "Viesti yritykselle (valinnainen)",
    accept: "Hyväksy tarjous",
    accepting: "Hyväksytään...",
    accepted: "Kiitos, olet hyväksynyt tarjouksen. Yritys vahvistaa varauksesi.",
    expired: "Tarjous on vanhentunut. Ota yhteyttä yritykseen uuden tarjouksen saamiseksi.",
    closed: "Tarjousta ei voi enää hyväksyä verkossa. Ota yhteyttä yritykseen.",
    notFound: "Linkki ei ole voimassa. Tarkista sähköpostisi linkki.",
    error: "Jokin meni vikaan. Yritä uudelleen.",
    consent: "Hyväksymällä hyväksyt yllä kuvatun tarjouksen.",
  },
  sv: {
    title: "Din offert",
    from: "Offert från",
    hello: "Hej",
    date: "Datum",
    time: "Tid",
    guests: "Gäster",
    space: "Utrymme",
    type: "Evenemang",
    menu: "Meny",
    requests: "Dina önskemål",
    invoicing: "Faktureringsuppgifter",
    validUntil: "Giltig till",
    note: "Meddelande till företaget (valfritt)",
    accept: "Godkänn offerten",
    accepting: "Godkänner...",
    accepted: "Tack, du har godkänt offerten. Företaget bekräftar din bokning.",
    expired: "Offerten har gått ut. Kontakta företaget för en ny offert.",
    closed: "Offerten kan inte längre godkännas online. Kontakta företaget.",
    notFound: "Länken är inte giltig. Kontrollera länken i ditt e-postmeddelande.",
    error: "Något gick fel. Försök igen.",
    consent: "Genom att godkänna samtycker du till offerten enligt ovan.",
  },
} as const;

type Lang = keyof typeof TXT;

export default function GuestOfferPage() {
  const { token } = useParams({ from: "/offer/$token" });
  const [offer, setOffer] = useState<GuestOffer | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await (supabase.rpc as any)("get_offer_for_guest", {
        _token: token,
      });
      if (!alive) return;
      if (error || !data) {
        setState("missing");
        return;
      }
      setOffer(data as GuestOffer);
      setState("ready");
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  const lang: Lang = (offer?.language as Lang) in TXT ? (offer!.language as Lang) : "en";
  const t = TXT[lang];

  const accept = async () => {
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)("accept_offer_by_guest", {
        _token: token,
        _note: note || null,
      });
      if (error) throw error;
      setResult(data?.reason ?? "error");
    } catch {
      setResult("error");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </main>
    );
  }

  if (state === "missing" || !offer) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground" role="alert">{TXT.en.notFound}</p>
      </main>
    );
  }

  const done =
    result === "accepted" ||
    result === "already_accepted" ||
    !!offer.guest_accepted_at ||
    offer.status === "confirmed";
  const blocked =
    !done && (offer.expired || result === "expired" ? "expired" : offer.status !== "sent" || result === "not_open" ? "closed" : null);

  const rows: [string, string | null][] = [
    [t.date, format(parseISO(offer.event_date), "d.M.yyyy")],
    [t.time, offer.end_time ? `${offer.start_time} to ${offer.end_time}` : offer.start_time],
    [t.guests, String(offer.guests_count)],
    [t.space, offer.event_space],
    [t.type, offer.event_type],
    [t.validUntil, offer.expires_on ? format(parseISO(offer.expires_on), "d.M.yyyy") : null],
  ];

  return (
    <main className="min-h-screen bg-muted/30 py-10 px-4" lang={lang}>
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          {offer.business_name && (
            <p className="text-sm text-muted-foreground">
              {t.from} {offer.business_name}
            </p>
          )}
          <CardTitle className="font-serif text-2xl">{t.title}</CardTitle>
          <p className="text-sm">
            {t.hello} {offer.guest_name},
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {rows
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
          {[
            [t.menu, offer.menu],
            [t.requests, offer.special_requests],
            [t.invoicing, offer.invoicing_details],
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <section key={k}>
                <h2 className="text-sm font-medium mb-1">{k}</h2>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{v}</p>
              </section>
            ))}

          {done ? (
            <p
              role="status"
              className="flex items-start gap-2 rounded-md border border-border bg-muted/50 p-3 text-sm"
            >
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0" aria-hidden />
              {t.accepted}
            </p>
          ) : blocked ? (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              {blocked === "expired" ? t.expired : t.closed}
            </p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="guest-offer-note">{t.note}</Label>
                <Textarea
                  id="guest-offer-note"
                  value={note}
                  maxLength={1000}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">{t.consent}</p>
              {result === "error" && (
                <p role="alert" className="text-sm text-destructive">{t.error}</p>
              )}
              <Button onClick={accept} disabled={busy} className="w-full sm:w-auto">
                {busy ? t.accepting : t.accept}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
