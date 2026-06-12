import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield, FileText, Bug, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import MarketingFooter from "@/components/MarketingFooter";
import SEOHead, { breadcrumbSchema } from "@/components/SEOHead";

const Security = () => {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SEOHead
        title="Security and Responsible Disclosure, MimmoBook"
        description="MimmoBook's security program, secure development practices, and how to report a vulnerability under our responsible disclosure policy."
        path="/security"
        jsonLd={breadcrumbSchema([
          { name: "Home", url: "https://mimmobook.com/" },
          { name: "Security", url: "https://mimmobook.com/security" },
        ])}
      />
      <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/"><Logo variant="color" size="sm" /></Link>
          <Link to="/"><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16 flex-1 space-y-10">
        <header>
          <div className="flex items-center gap-3 mb-3">
            <Shield className="h-8 w-8 text-accent" />
            <h1 className="text-3xl sm:text-4xl font-serif font-bold">Security at MimmoBook</h1>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            We take the security of our customers, their staff, and their guests seriously. This page
            describes our security program, how we develop and ship code safely, and how to report a
            vulnerability you have found.
          </p>
        </header>

        <section>
          <h2 className="text-xl font-serif font-bold flex items-center gap-2 mb-3">
            <Bug className="h-5 w-5 text-accent" /> Reporting a vulnerability
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            If you believe you have found a security issue in MimmoBook, please report it privately to{" "}
            <a href="mailto:security@mimmobook.com" className="text-accent hover:underline font-medium">
              security@mimmobook.com
            </a>. We will acknowledge your report within 2 business days and aim to give a substantive
            update within 5 business days.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-3">
            Please give us reasonable time to investigate and fix the issue before any public
            disclosure. We will credit you in our acknowledgments section unless you ask us not to.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            A machine-readable contact is also published at{" "}
            <a href="/.well-known/security.txt" className="text-accent hover:underline">/.well-known/security.txt</a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-serif font-bold mb-3">Safe harbor</h2>
          <p className="text-muted-foreground leading-relaxed">
            We will not pursue legal action against researchers who act in good faith, avoid privacy
            violations, do not degrade the service, and do not access more data than necessary to
            demonstrate the issue. Do not test against other customers' tenants, and never use real
            personal data.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-serif font-bold mb-3">Out of scope</h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>Reports based solely on automated scanner output without a working proof of concept.</li>
            <li>Missing security headers without a demonstrated impact.</li>
            <li>Rate limiting or denial-of-service attempts against production.</li>
            <li>Social engineering of MimmoBook staff or customers.</li>
            <li>Physical attacks.</li>
            <li>Vulnerabilities in third-party services we depend on (please report those upstream).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-serif font-bold flex items-center gap-2 mb-3">
            <Lock className="h-5 w-5 text-accent" /> Our security program
          </h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2 leading-relaxed">
            <li>
              <strong>Tenant isolation:</strong> Every table that holds customer data has Row Level
              Security enabled and tenant-scoped policies, verified by automated cross-tenant tests on
              every pull request.
            </li>
            <li>
              <strong>Authentication:</strong> Email + password with a 12-character minimum and live
              Have I Been Pwned breach detection. MFA available for all users and mandatory for system
              administrators.
            </li>
            <li>
              <strong>Encryption:</strong> TLS 1.2 or higher in transit; AES-256 at rest for database
              and object storage.
            </li>
            <li>
              <strong>Audit logging:</strong> All sensitive changes are recorded with a 90 day
              retention and reversible history.
            </li>
            <li>
              <strong>Continuous testing:</strong> Pull requests run dependency audit, CodeQL static
              analysis, RLS cross-tenant adversarial tests, storage attack tests, and edge-function
              security tests. Failures block merge.
            </li>
            <li>
              <strong>Backups:</strong> Encrypted daily backups, 30 day rolling.
            </li>
            <li>
              <strong>Subprocessor governance:</strong> See{" "}
              <Link to="/legal/subprocessors" className="text-accent hover:underline">subprocessor list</Link>.
              30 day prior notice for any change.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-serif font-bold flex items-center gap-2 mb-3">
            <FileText className="h-5 w-5 text-accent" /> Transparency artifacts
          </h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2 leading-relaxed">
            <li>
              <strong>Software Bill of Materials (SBOM):</strong> CycloneDX 1.5 format, regenerated on
              every dependency change. Available on request at{" "}
              <a href="mailto:security@mimmobook.com" className="text-accent hover:underline">security@mimmobook.com</a>.
            </li>
            <li>
              <strong>Penetration testing:</strong> Annual third-party penetration test plus targeted
              tests after major architectural changes. Summary report available under NDA.
            </li>
            <li>
              <strong>Secure development lifecycle:</strong> Documented SDLC covering threat modeling,
              code review, dependency management, secret handling, and incident response.
            </li>
            <li>
              <strong>Vulnerability scanning:</strong> Daily dependency audit and weekly SBOM
              regeneration in CI. Findings at high or critical severity block deploy.
            </li>
          </ul>
        </section>

        <section id="hall-of-fame">
          <h2 className="text-xl font-serif font-bold mb-3">Acknowledgments</h2>
          <p className="text-muted-foreground leading-relaxed">
            We thank the security researchers who have helped us improve MimmoBook. Names are added
            here with explicit consent after a coordinated disclosure.
          </p>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
};

export default Security;
