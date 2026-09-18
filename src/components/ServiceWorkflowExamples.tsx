import { Scissors, Sparkles, CroissantIcon, Dumbbell, CalendarCheck, Users, Receipt, Star } from "lucide-react";
import { useT, type TranslationKey } from "@/contexts/I18nContext";

/**
 * Step-by-step workflow examples for service industry professionals.
 * Icons and numbered steps only, no photography (per project style).
 */
const workflows: {
  icon: typeof Scissors;
  focusIcon: typeof CalendarCheck;
  roleKey: TranslationKey;
  focusKey: TranslationKey;
  stepKeys: TranslationKey[];
}[] = [
  {
    icon: Scissors,
    focusIcon: CalendarCheck,
    roleKey: "useCases.wf1Role",
    focusKey: "useCases.wf1Focus",
    stepKeys: ["useCases.wf1S1", "useCases.wf1S2", "useCases.wf1S3", "useCases.wf1S4"],
  },
  {
    icon: Sparkles,
    focusIcon: Users,
    roleKey: "useCases.wf2Role",
    focusKey: "useCases.wf2Focus",
    stepKeys: ["useCases.wf2S1", "useCases.wf2S2", "useCases.wf2S3", "useCases.wf2S4"],
  },
  {
    icon: CroissantIcon,
    focusIcon: Receipt,
    roleKey: "useCases.wf3Role",
    focusKey: "useCases.wf3Focus",
    stepKeys: ["useCases.wf3S1", "useCases.wf3S2", "useCases.wf3S3", "useCases.wf3S4"],
  },
  {
    icon: Dumbbell,
    focusIcon: Star,
    roleKey: "useCases.wf4Role",
    focusKey: "useCases.wf4Focus",
    stepKeys: ["useCases.wf4S1", "useCases.wf4S2", "useCases.wf4S3", "useCases.wf4S4"],
  },
];

const ServiceWorkflowExamples = () => {
  const t = useT();

  return (
    <section className="py-16 md:py-24 bg-secondary/40" aria-labelledby="service-workflows-title">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 max-w-2xl mx-auto">
          <h2 id="service-workflows-title" className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-4">
            {t("useCases.workflowsTitle")}
          </h2>
          <p className="text-muted-foreground leading-relaxed">{t("useCases.workflowsSubtitle")}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {workflows.map((wf) => (
            <article key={wf.roleKey} className="p-6 rounded-xl border border-border bg-card">
              <div className="flex items-start gap-4 mb-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  <wf.icon className="h-6 w-6 text-accent" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-serif font-semibold text-foreground text-lg">{t(wf.roleKey)}</h3>
                  <p className="inline-flex items-center gap-1.5 text-xs font-medium text-accent mt-1">
                    <wf.focusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    {t(wf.focusKey)}
                  </p>
                </div>
              </div>

              <ol className="space-y-3">
                {wf.stepKeys.map((key, index) => (
                  <li key={key} className="flex gap-3">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent text-xs font-semibold"
                      aria-hidden="true"
                    >
                      {index + 1}
                    </span>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t(key)}</p>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServiceWorkflowExamples;
