import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import MarketingFooter from "@/components/MarketingFooter";
import SEOHead, { breadcrumbSchema } from "@/components/SEOHead";

const DPA = () => {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SEOHead
        title="Data Processing Agreement, MimmoBook"
        description="MimmoBook's standard Data Processing Agreement (DPA) covering Article 28 GDPR obligations between MimmoBook (processor) and the customer (controller)."
        path="/legal/dpa"
        jsonLd={breadcrumbSchema([
          { name: "Home", url: "https://mimmobook.com/" },
          { name: "DPA", url: "https://mimmobook.com/legal/dpa" },
        ])}
      />
      <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-lg print:hidden">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/"><Logo variant="color" size="sm" /></Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
              <Download className="h-4 w-4" /> Print or save as PDF
            </Button>
            <Link to="/"><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16 flex-1">
        <h1 className="text-3xl sm:text-4xl font-serif font-bold mb-2">Data Processing Agreement</h1>
        <p className="text-sm text-muted-foreground mb-10">
          Version 1.0, effective {new Date().toLocaleDateString("en-GB", { month: "long", day: "numeric", year: "numeric" })}
        </p>

        <div className="space-y-8 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-xl font-serif font-bold text-foreground mb-2">1. Parties and scope</h2>
            <p>
              This Data Processing Agreement ("DPA") forms part of the MimmoBook Terms of Service between
              MimmoBook ("Processor") and the customer ("Controller"). It applies whenever MimmoBook
              processes personal data on behalf of the Controller in the course of providing the MimmoBook
              reservation management service ("Service").
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-foreground mb-2">2. Subject matter and duration</h2>
            <p>
              The subject matter is the processing of personal data necessary to operate the Service.
              The duration of the processing equals the duration of the Controller's subscription, plus
              the deletion period described in section 9.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-foreground mb-2">3. Nature and purpose of processing</h2>
            <p>
              MimmoBook processes personal data solely to host, secure, support and improve the Service.
              The Processor will not use Controller personal data for its own marketing or for any
              purpose outside of the documented instructions of the Controller.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-foreground mb-2">4. Categories of data subjects and personal data</h2>
            <p>
              Data subjects include the Controller's staff users and the Controller's end guests who
              submit reservations. Categories of personal data include contact details (name, email,
              phone), reservation details, optional dietary notes, and authentication credentials.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-foreground mb-2">5. Processor obligations (Art. 28)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Process personal data only on documented instructions from the Controller.</li>
              <li>Ensure persons authorised to process the data are bound by confidentiality.</li>
              <li>Implement appropriate technical and organisational measures (see section 7).</li>
              <li>Assist the Controller with data subject requests and DPIAs where reasonably required.</li>
              <li>Make available all information necessary to demonstrate compliance with Art. 28 GDPR.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-foreground mb-2">6. Subprocessors</h2>
            <p>
              The Controller grants general authorisation for the use of the subprocessors listed at{" "}
              <Link to="/legal/subprocessors" className="text-accent hover:underline">/legal/subprocessors</Link>.
              MimmoBook will give at least 30 days written notice before adding or replacing a
              subprocessor that handles personal data, during which the Controller may object on
              reasonable data protection grounds and, if the parties cannot agree, terminate the affected
              part of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-foreground mb-2">7. Security measures</h2>
            <p>
              MimmoBook implements industry-standard measures including encryption in transit (TLS 1.2 or
              higher) and at rest, role-based access control with row-level security, multi-factor
              authentication for administrators, audit logging, automated backups, vulnerability
              scanning, and least-privilege production access. A summary is available on request.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-foreground mb-2">8. International transfers</h2>
            <p>
              Where personal data is transferred outside the European Economic Area, MimmoBook relies on
              the European Commission Standard Contractual Clauses (Decision 2021/914) and applies
              supplementary measures where necessary.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-foreground mb-2">9. Return and deletion</h2>
            <p>
              Within 30 days after termination of the Service, MimmoBook will, at the Controller's choice,
              delete or return all personal data and delete existing copies, except where retention is
              required by law. Backups are overwritten on a 30 day rolling schedule.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-foreground mb-2">10. Personal data breach notification</h2>
            <p>
              MimmoBook will notify the Controller without undue delay and in any case within 72 hours
              after becoming aware of a personal data breach affecting Controller data. The notice will
              include the nature of the breach, categories and approximate number of data subjects
              affected, likely consequences, and measures taken or proposed to address it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-foreground mb-2">11. Audits</h2>
            <p>
              The Controller may, no more than once per year and on 30 days written notice, audit
              MimmoBook's compliance with this DPA. MimmoBook may satisfy this obligation by providing a
              recent independent third-party audit report.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-foreground mb-2">12. Governing law</h2>
            <p>
              This DPA is governed by the laws of Finland, without regard to its conflict of laws rules.
              Disputes are subject to the exclusive jurisdiction of the courts of Helsinki.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-foreground mb-2">13. Signing</h2>
            <p>
              By using the MimmoBook Service, the Controller accepts this DPA. If the Controller requires
              a counter-signed copy, email{" "}
              <a href="mailto:privacy@mimmobook.com" className="text-accent hover:underline">privacy@mimmobook.com</a>{" "}
              and we will return one within 5 business days.
            </p>
          </section>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
};

export default DPA;
