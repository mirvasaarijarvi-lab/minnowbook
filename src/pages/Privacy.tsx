import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Logo from "@/components/Logo";
import MarketingFooter from "@/components/MarketingFooter";
import { useT, useLanguage } from "@/contexts/I18nContext";

const Privacy = () => {
  const t = useT();
  const { language } = useLanguage();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const dateStr = new Date().toLocaleDateString(
    language === "fi" ? "fi-FI" : language === "sv" ? "sv-SE" : "en-US",
    { month: "long", day: "numeric", year: "numeric" }
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
      <h2 className="text-xl font-serif font-bold text-foreground">{title}</h2>
      {children}
    </section>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/"><Logo variant="color" size="sm" /></Link>
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> {t("common.back")}
            </Button>
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16 flex-1">
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-foreground mb-2">
          {t("privacy.title" as any)}
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          {t("privacy.lastUpdated" as any)} {dateStr}
        </p>

        <div className="space-y-8">
          <Section title={t("privacy.s1Title" as any)}>
            <p className="text-muted-foreground leading-relaxed mt-2">{t("privacy.s1P1" as any)}</p>
          </Section>

          <Section title={t("privacy.s2Title" as any)}>
            <p className="text-muted-foreground leading-relaxed mt-2">{t("privacy.s2P1" as any)}</p>
          </Section>

          <Section title={t("privacy.s3Title" as any)}>
            <p className="text-muted-foreground leading-relaxed mt-2">{t("privacy.s3P1" as any)}</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>{t("privacy.s3Item1" as any)}</li>
              <li>{t("privacy.s3Item2" as any)}</li>
              <li>{t("privacy.s3Item3" as any)}</li>
              <li>{t("privacy.s3Item4" as any)}</li>
            </ul>
          </Section>

          <Section title={t("privacy.s4Title" as any)}>
            <p className="text-muted-foreground leading-relaxed mt-2">{t("privacy.s4P1" as any)}</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>{t("privacy.s4Item1" as any)}</li>
              <li>{t("privacy.s4Item2" as any)}</li>
              <li>{t("privacy.s4Item3" as any)}</li>
            </ul>
          </Section>

          <Section title={t("privacy.s5Title" as any)}>
            <p className="text-muted-foreground leading-relaxed mt-2">{t("privacy.s5P1" as any)}</p>
          </Section>

          <Section title={t("privacy.s6Title" as any)}>
            <p className="text-muted-foreground leading-relaxed mt-2">{t("privacy.s6P1" as any)}</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>{t("privacy.s6Item1" as any)}</li>
              <li>{t("privacy.s6Item2" as any)}</li>
              <li>{t("privacy.s6Item3" as any)}</li>
              <li>{t("privacy.s6Item4" as any)}</li>
              <li>{t("privacy.s6Item5" as any)}</li>
            </ul>
          </Section>

          <Section title={t("privacy.s7Title" as any)}>
            <p className="text-muted-foreground leading-relaxed mt-2">{t("privacy.s7P1" as any)}</p>
          </Section>

          <Section title={t("privacy.s8Title" as any)}>
            <p className="text-muted-foreground leading-relaxed mt-2">{t("privacy.s8P1" as any)}</p>
          </Section>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
};

export default Privacy;
