import {
  CalendarCheck,
  FilePlus2,
  MailCheck,
  BadgeCheck,
  ArrowRight,
  ArrowDown,
  Keyboard,
  CopyX,
  Zap,
  BarChart3,
} from "lucide-react";
import { useT } from "@/contexts/I18nContext";

/**
 * Flow diagram and benefit tiles for the "offer from a guest booking" post.
 * Icons and shapes only, no photography; all copy comes from i18n.
 */
const OfferFlowInfographic = () => {
  const t = useT();

  const steps = [
    { icon: CalendarCheck, n: 1 },
    { icon: FilePlus2, n: 2 },
    { icon: MailCheck, n: 3 },
    { icon: BadgeCheck, n: 4 },
  ].map((s) => ({
    ...s,
    title: t(`blog.ofStep${s.n}Title` as any),
    desc: t(`blog.ofStep${s.n}Desc` as any),
  }));

  const benefits = [Keyboard, CopyX, Zap, BarChart3].map((icon, i) => ({
    icon,
    title: t(`blog.ofBenefit${i + 1}Title` as any),
    desc: t(`blog.ofBenefit${i + 1}Desc` as any),
  }));

  return (
    <div className="not-prose mb-12 space-y-10">
      <section
        aria-label={t("blog.ofTitle")}
        className="rounded-xl border border-border bg-card p-6 md:p-8 shadow-card"
      >
        <h2 className="font-serif text-xl md:text-2xl font-bold text-foreground mb-2">
          {t("blog.ofTitle")}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {t("blog.ofCaption")}
        </p>
        <ol className="m-0 flex list-none flex-col items-stretch gap-3 p-0 md:flex-row md:items-start">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const last = i === steps.length - 1;
            return (
              <li
                key={s.n}
                className="flex flex-col items-center gap-3 md:flex-1 md:flex-row md:items-start"
              >
                <div
                  className={`flex w-full flex-col items-center rounded-lg p-4 text-center ${
                    last
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/5 text-foreground"
                  }`}
                >
                  <span className="relative mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm">
                    <Icon className="h-6 w-6 text-accent" aria-hidden />
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground">
                      {s.n}
                    </span>
                  </span>
                  <p className="font-semibold">{s.title}</p>
                  <p
                    className={`mt-1 text-sm leading-snug ${
                      last ? "text-primary-foreground/85" : "text-muted-foreground"
                    }`}
                  >
                    {s.desc}
                  </p>
                </div>
                {!last && (
                  <>
                    <ArrowDown
                      className="h-5 w-5 shrink-0 text-accent md:hidden"
                      aria-hidden
                    />
                    <ArrowRight
                      className="mt-12 hidden h-5 w-5 shrink-0 text-accent md:block"
                      aria-hidden
                    />
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-label={t("blog.ofBenefitsTitle")}>
        <h2 className="font-serif text-xl md:text-2xl font-bold text-foreground mb-4">
          {t("blog.ofBenefitsTitle")}
        </h2>
        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
          {benefits.map((b) => {
            const Icon = b.icon;
            return (
              <li
                key={b.title}
                className="flex gap-3 rounded-xl border border-border bg-card p-5 shadow-card"
              >
                <Icon className="h-6 w-6 shrink-0 text-accent" aria-hidden />
                <div>
                  <p className="font-semibold text-foreground">{b.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground leading-snug">
                    {b.desc}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
};

export default OfferFlowInfographic;
