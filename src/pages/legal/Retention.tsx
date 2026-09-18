import { useEffect } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import MarketingFooter from "@/components/MarketingFooter";
import SEOHead, { breadcrumbSchema } from "@/components/SEOHead";
import ProtectedEmail from "@/components/ProtectedEmail";


const rows: { category: string; data: string; period: string }[] = [
  { category: "Active reservations", data: "Guest name, contact, date, resource, notes", period: "Until the tenant deletes them or closes the account" },
  { category: "Past reservations", data: "Same as above", period: "Archived 30 days after the event date, permanently deleted after 400 days" },
  { category: "Audit log", data: "Who changed what and when", period: "90 days, then automatically purged" },
  { category: "Booking validation log", data: "Anti-abuse signals on public booking pages", period: "30 days" },
  { category: "Storage rejection events", data: "Upload anti-abuse signals", period: "7 days (events), 90 days (resolved alerts)" },
  { category: "Email send log", data: "Message id, recipient, status", period: "Rolling, aligned with deliverability TTLs" },
  { category: "Email suppressions", data: "Bounced or unsubscribed addresses", period: "Kept indefinitely to honor opt-outs" },
  { category: "Login history", data: "Timestamp, device, IP hash", period: "180 days" },
  { category: "Account profile", data: "Email, display name, avatar", period: "Until account deletion plus a 30 day cancellation window" },
  { category: "Backups", data: "Encrypted full database backups", period: "30 days rolling, then overwritten" },
  { category: "Support requests", data: "Message content, contact info", period: "24 months after resolution" },
];

const Retention = () => {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SEOHead
        title="Data Retention Schedule, MimmoBook"
        description="How long MimmoBook keeps each category of data, in line with GDPR data minimisation and storage limitation principles."
        path="/legal/retention"
        jsonLd={breadcrumbSchema([
          { name: "Home", url: "https://mimmobook.com/" },
          { name: "Retention Schedule", url: "https://mimmobook.com/legal/retention" },
        ])}
      />
      <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/"><Logo variant="color" size="sm" /></Link>
          <Link to="/"><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16 flex-1">
        <h1 className="text-3xl sm:text-4xl font-serif font-bold mb-2">Data Retention Schedule</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Last updated: {new Date().toLocaleDateString("en-GB", { month: "long", day: "numeric", year: "numeric" })}
        </p>
        <p className="text-muted-foreground leading-relaxed mb-8">
          MimmoBook follows the GDPR principles of data minimisation and storage limitation. We only keep
          personal data for as long as it serves a clear purpose. The table below lists the categories of
          data we process and how long each is retained. When a retention period ends, the data is deleted
          or irreversibly anonymised.
        </p>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-semibold">Category</th>
                <th className="text-left p-3 font-semibold">Data</th>
                <th className="text-left p-3 font-semibold">Retention period</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.category} className="border-t border-border">
                  <td className="p-3 font-medium">{r.category}</td>
                  <td className="p-3 text-muted-foreground">{r.data}</td>
                  <td className="p-3 text-muted-foreground">{r.period}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="text-xl font-serif font-bold mt-10 mb-2">Deletion on request</h2>
        <p className="text-muted-foreground leading-relaxed">
          You can request deletion of your personal data at any time by using the self-service account
          deletion in your profile, or by emailing our privacy contact{" "}
          <ProtectedEmail user="privacy" subject="Data deletion request" className="text-accent hover:underline font-medium" />.
          The address is hidden from automated crawlers and revealed on click. Some data may be retained
          for a limited period to meet legal obligations (for example, invoicing records under Finnish
          accounting law).
        </p>
        <p className="text-muted-foreground leading-relaxed mt-3">
          What to expect: we confirm your request within 2 business days and complete it within 30 days,
          as required by the GDPR. Please write from the email address on your account and name the
          business, so we can verify the request without asking for extra personal data.
        </p>

      </main>
      <MarketingFooter />
    </div>
  );
};

export default Retention;
