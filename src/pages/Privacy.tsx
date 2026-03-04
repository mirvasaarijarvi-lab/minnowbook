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
          {t("privacy.title")}
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          {t("privacy.lastUpdated")} {dateStr}
        </p>

        <div className="space-y-8">
          <Section title={t("privacy.s1Title")}>
            <p className="text-muted-foreground leading-relaxed mt-2">{t("privacy.s1P1")}</p>
          </Section>

          <Section title={t("privacy.s2Title")}>
            <p className="text-muted-foreground leading-relaxed mt-2">{t("privacy.s2P1")}</p>
          </Section>

          <Section title={t("privacy.s3Title")}>
            <p className="text-muted-foreground leading-relaxed mt-2">{t("privacy.s3P1")}</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>{t("privacy.s3Item1")}</li>
              <li>{t("privacy.s3Item2")}</li>
              <li>{t("privacy.s3Item3")}</li>
              <li>{t("privacy.s3Item4")}</li>
            </ul>
          </Section>

          <Section title={t("privacy.s4Title")}>
            <p className="text-muted-foreground leading-relaxed mt-2">{t("privacy.s4P1")}</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>{t("privacy.s4Item1")}</li>
              <li>{t("privacy.s4Item2")}</li>
              <li>{t("privacy.s4Item3")}</li>
            </ul>
          </Section>

          <Section title={t("privacy.s5Title")}>
            <p className="text-muted-foreground leading-relaxed mt-2">{t("privacy.s5P1")}</p>
          </Section>

          <Section title={t("privacy.s6Title")}>
            <p className="text-muted-foreground leading-relaxed mt-2">{t("privacy.s6P1")}</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>{t("privacy.s6Item1")}</li>
              <li>{t("privacy.s6Item2")}</li>
              <li>{t("privacy.s6Item3")}</li>
              <li>{t("privacy.s6Item4")}</li>
              <li>{t("privacy.s6Item5")}</li>
            </ul>
          </Section>

          <Section title={t("privacy.s7Title")}>
            <p className="text-muted-foreground leading-relaxed mt-2">{t("privacy.s7P1")}</p>
          </Section>

          <Section title={t("privacy.s8Title")}>
            <p className="text-muted-foreground leading-relaxed mt-2">{t("privacy.s8P1")}</p>
          </Section>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
};

export default Privacy;
