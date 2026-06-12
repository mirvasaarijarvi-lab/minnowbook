import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import MarketingFooter from "@/components/MarketingFooter";
import SEOHead, { breadcrumbSchema } from "@/components/SEOHead";

const subprocessors = [
  { name: "Supabase (via Lovable Cloud)", purpose: "Database, authentication, file storage, edge functions", data: "All application data, account credentials, uploaded files", region: "European Union (Frankfurt)" },
  { name: "Resend", purpose: "Transactional and notification email delivery", data: "Recipient email, subject, message body", region: "European Union and United States (SCCs in place)" },
  { name: "Stripe", purpose: "Subscription billing and payments", data: "Billing name, address, payment method metadata (no card data ever reaches MimmoBook)", region: "European Union and United States (SCCs in place)" },
  { name: "Google (Search Console, Analytics 4, Tag Manager)", purpose: "Aggregated traffic analytics and SEO", data: "Anonymised page views, device, country (loaded only after analytics consent)", region: "European Union and United States (SCCs in place)" },
  { name: "Lovable AI Gateway", purpose: "Optional AI features inside the product", data: "Only the prompts the user explicitly submits", region: "European Union and United States" },
  { name: "Lovable (hosting and CDN)", purpose: "Static site hosting and CDN delivery", data: "HTTP request metadata", region: "Global edge network" },
];

const Subprocessors = () => {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SEOHead
        title="Subprocessor Inventory, MimmoBook"
        description="Complete list of the third-party processors MimmoBook uses to operate the service, including purpose, data categories, and processing region."
        path="/legal/subprocessors"
        jsonLd={breadcrumbSchema([
          { name: "Home", url: "https://mimmobook.com/" },
          { name: "Subprocessors", url: "https://mimmobook.com/legal/subprocessors" },
        ])}
      />
      <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/"><Logo variant="color" size="sm" /></Link>
          <Link to="/"><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16 flex-1">
        <h1 className="text-3xl sm:text-4xl font-serif font-bold mb-2">Subprocessor Inventory</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Last updated: {new Date().toLocaleDateString("en-GB", { month: "long", day: "numeric", year: "numeric" })}
        </p>
        <p className="text-muted-foreground leading-relaxed mb-8">
          MimmoBook relies on a small number of carefully selected subprocessors to deliver the service.
          Each one is bound by a written data processing agreement that requires the same level of
          protection we owe to you under GDPR. Transfers outside the European Economic Area are covered
          by the European Commission Standard Contractual Clauses (SCCs).
        </p>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-semibold">Subprocessor</th>
                <th className="text-left p-3 font-semibold">Purpose</th>
                <th className="text-left p-3 font-semibold">Data categories</th>
                <th className="text-left p-3 font-semibold">Region</th>
              </tr>
            </thead>
            <tbody>
              {subprocessors.map((s) => (
                <tr key={s.name} className="border-t border-border">
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3 text-muted-foreground">{s.purpose}</td>
                  <td className="p-3 text-muted-foreground">{s.data}</td>
                  <td className="p-3 text-muted-foreground">{s.region}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="text-xl font-serif font-bold mt-10 mb-2">Notifications of changes</h2>
        <p className="text-muted-foreground leading-relaxed">
          We notify customers by email at least 30 days before adding or replacing a subprocessor that
          handles personal data. If you want to receive these notifications, email{" "}
          <a href="mailto:privacy@mimmobook.com" className="text-accent hover:underline">privacy@mimmobook.com</a>{" "}
          and ask to be added to the subprocessor change list.
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
};

export default Subprocessors;
