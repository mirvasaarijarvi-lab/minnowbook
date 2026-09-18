import {
  CalendarCheck,
  MailCheck,
  BellRing,
  Repeat,
  Scissors,
  HandHeart,
  Croissant,
  Dumbbell,
  Check,
} from "lucide-react";
import { useT } from "@/contexts/I18nContext";
import heroImage from "@/assets/blog-service-professionals.jpg";

/**
 * Visual block for the "booking software for service professionals" blog post:
 * a photo strip, a four step booking-flow infographic, outcome tiles, a
 * who-it-is-for list and a benefit bullet list. All copy comes from i18n so the
 * post reads correctly in EN, FI and SV.
 */
const ServiceProInfographic = () => {
  const t = useT();

  const flow = [
    { icon: CalendarCheck, title: t("blog.spFlow1Title"), desc: t("blog.spFlow1Desc") },
    { icon: MailCheck, title: t("blog.spFlow2Title"), desc: t("blog.spFlow2Desc") },
    { icon: BellRing, title: t("blog.spFlow3Title"), desc: t("blog.spFlow3Desc") },
    { icon: Repeat, title: t("blog.spFlow4Title"), desc: t("blog.spFlow4Desc") },
  ];

  const stats = [
    { value: "24/7", label: t("blog.spStat1Label") },
    { value: "-30 %", label: t("blog.spStat2Label") },
    { value: "30 s", label: t("blog.spStat3Label") },
  ];

  const who = [
    { icon: Scissors, label: t("blog.spWho1") },
    { icon: HandHeart, label: t("blog.spWho2") },
    { icon: Croissant, label: t("blog.spWho3") },
    { icon: Dumbbell, label: t("blog.spWho4") },
  ];

  const benefits = [
    t("blog.spBenefit1"),
    t("blog.spBenefit2"),
    t("blog.spBenefit3"),
    t("blog.spBenefit4"),
    t("blog.spBenefit5"),
    t("blog.spBenefit6"),
  ];

  return (
    <div className="not-prose mb-12 space-y-10">
      {/* Photo */}
      <figure className="m-0">
        <img
          src={heroImage}
          alt={t("blog.spHeroAlt")}
          width={1600}
          height={912}
          className="w-full rounded-xl border border-border object-cover shadow-card"
        />
        <figcaption className="mt-3 text-sm text-muted-foreground">{t("blog.spHeroCaption")}</figcaption>
      </figure>

      {/* Infographic: booking flow */}
      <section
        aria-label={t("blog.spFlowTitle")}
        className="rounded-xl border border-border bg-card p-6 md:p-8 shadow-card"
      >
        <h2 className="font-serif text-xl md:text-2xl font-bold text-foreground mb-2">
          {t("blog.spFlowTitle")}
        </h2>
        <p className="text-sm text-muted-foreground mb-8">{t("blog.spFlowCaption")}</p>

        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 list-none p-0 m-0">
          {flow.map((step, i) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="relative rounded-lg border border-border bg-background p-5 flex flex-col gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {i + 1}/4
                  </span>
                </div>
                <h3 className="font-semibold text-foreground text-base leading-snug">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </li>
            );
          })}
        </ol>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg bg-primary/5 p-5 text-center">
              <div className="font-serif text-3xl font-bold text-foreground">{s.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Who it is for */}
      <section aria-label={t("blog.spWhoTitle")}>
        <h2 className="font-serif text-xl md:text-2xl font-bold text-foreground mb-4">
          {t("blog.spWhoTitle")}
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 list-none p-0 m-0">
          {who.map((w) => {
            const Icon = w.icon;
            return (
              <li
                key={w.label}
                className="flex items-start gap-3 rounded-lg border border-border bg-card p-4"
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                <span className="text-sm text-muted-foreground leading-relaxed">{w.label}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Benefits */}
      <section aria-label={t("blog.spBenefitsTitle")}>
        <h2 className="font-serif text-xl md:text-2xl font-bold text-foreground mb-4">
          {t("blog.spBenefitsTitle")}
        </h2>
        <ul className="space-y-3 list-none p-0 m-0">
          {benefits.map((b) => (
            <li key={b} className="flex items-start gap-3">
              <Check className="mt-1 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              <span className="text-sm md:text-base text-muted-foreground leading-relaxed">{b}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default ServiceProInfographic;
