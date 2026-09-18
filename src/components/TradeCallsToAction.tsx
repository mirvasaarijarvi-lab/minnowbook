import { Link } from "@/lib/router-compat";
import { ArrowRight, Scissors, Wind, Sparkles, CroissantIcon, Brush, Dumbbell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/contexts/I18nContext";
import type { TranslationKey } from "@/i18n/translations";

/**
 * Trade-specific calls to action. Each tile speaks to one profession and
 * links to signup with the trade recorded in the query string, so the
 * source of the signup stays visible in analytics.
 */
const trades: {
  slug: string;
  icon: typeof Scissors;
  nameKey: TranslationKey;
  lineKey: TranslationKey;
  buttonKey: TranslationKey;
}[] = [
  { slug: "barber", icon: Scissors, nameKey: "useCases.tradeCtaBarberName", lineKey: "useCases.tradeCtaBarberLine", buttonKey: "useCases.tradeCtaBarberButton" },
  { slug: "hairdresser", icon: Wind, nameKey: "useCases.tradeCtaHairdresserName", lineKey: "useCases.tradeCtaHairdresserLine", buttonKey: "useCases.tradeCtaHairdresserButton" },
  { slug: "massage-therapist", icon: Sparkles, nameKey: "useCases.tradeCtaMassageName", lineKey: "useCases.tradeCtaMassageLine", buttonKey: "useCases.tradeCtaMassageButton" },
  { slug: "baker", icon: CroissantIcon, nameKey: "useCases.tradeCtaBakerName", lineKey: "useCases.tradeCtaBakerLine", buttonKey: "useCases.tradeCtaBakerButton" },
  { slug: "makeup-artist", icon: Brush, nameKey: "useCases.tradeCtaMakeupName", lineKey: "useCases.tradeCtaMakeupLine", buttonKey: "useCases.tradeCtaMakeupButton" },
  { slug: "personal-trainer", icon: Dumbbell, nameKey: "useCases.tradeCtaTrainerName", lineKey: "useCases.tradeCtaTrainerLine", buttonKey: "useCases.tradeCtaTrainerButton" },
];

const TradeCallsToAction = () => {
  const t = useT();

  return (
    <section className="py-16 md:py-24" aria-labelledby="trade-cta-title">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 max-w-2xl mx-auto">
          <h2 id="trade-cta-title" className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-4">
            {t("useCases.tradeCtaTitle")}
          </h2>
          <p className="text-muted-foreground leading-relaxed">{t("useCases.tradeCtaSubtitle")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {trades.map((trade) => (
            <div
              key={trade.slug}
              className="flex flex-col p-6 rounded-xl border border-border bg-card hover:border-accent/40 transition-colors"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/10 mb-4">
                <trade.icon className="h-5 w-5 text-accent" aria-hidden="true" />
              </div>
              <h3 className="font-serif font-semibold text-foreground text-lg mb-2">{t(trade.nameKey)}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5 flex-1">{t(trade.lineKey)}</p>
              <Button variant="outline" className="w-full justify-between" asChild>
                <Link to={`/signup?trade=${trade.slug}`}>
                  {t(trade.buttonKey)}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TradeCallsToAction;
