import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Logo from "@/components/Logo";
import MarketingFooter from "@/components/MarketingFooter";
import { useT, useLanguage } from "@/contexts/I18nContext";

const Accessibility = () => {
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
          {t("a11y.title")}
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          {t("a11y.lastUpdated")} {dateStr}
        </p>

        <div className="space-y-8">
          <Section title={t("a11y.s1Title")}>
            <p className="text-muted-foreground leading-relaxed mt-2">{t("a11y.s1P1")}</p>
          </Section>

          <Section title={t("a11y.s2Title")}>
            <p className="text-muted-foreground leading-relaxed mt-2">{t("a11y.s2P1")}</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>{t("a11y.s2Item1")}</li>
              <li>{t("a11y.s2Item2")}</li>
              <li>{t("a11y.s2Item3")}</li>
              <li>{t("a11y.s2Item4")}</li>
              <li>{t("a11y.s2Item5")}</li>
              <li>{t("a11y.s2Item6")}</li>
            </ul>
          </Section>

          <Section title={t("a11y.s3Title")}>
            <p className="text-muted-foreground leading-relaxed mt-2">{t("a11y.s3P1")}</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>{t("a11y.s3Item1")}</li>
              <li>{t("a11y.s3Item2")}</li>
              <li>{t("a11y.s3Item3")}</li>
            </ul>
          </Section>

          <Section title={t("a11y.s4Title")}>
            <p className="text-muted-foreground leading-relaxed mt-2">{t("a11y.s4P1")}</p>
          </Section>

          <Section title={t("a11y.s5Title")}>
            <p className="text-muted-foreground leading-relaxed mt-2">{t("a11y.s5P1")}</p>
          </Section>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
};

export default Accessibility;
