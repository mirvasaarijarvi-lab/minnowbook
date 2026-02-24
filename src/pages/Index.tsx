import { Link } from "react-router-dom";
import restaurantImg from "@/assets/restaurant-wiurila.jpg";
import venueImg from "@/assets/venue-wiurila.jpg";
import gasthausImg from "@/assets/gasthaus-wiurila.jpg";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UtensilsCrossed, Building2, Bed, Lock } from "lucide-react";

const bookingTypes = [
  {
    icon: UtensilsCrossed,
    title: "Ravintola",
    description: "Varaa pöytä ravintola Sigridistä",
    link: "/ravintola",
    cta: "Varaa pöytä",
    image: restaurantImg,
  },
  {
    icon: Building2,
    title: "Juhlatilat",
    description: "Tiedustele juhlatiloja tapahtumallesi",
    link: "/juhlatilat",
    cta: "Tiedustele tiloja",
    image: venueImg,
  },
  {
    icon: Bed,
    title: "Gasthaus",
    description: "Varaa majoitus Gasthaus Wiurilasta",
    link: "/gasthaus",
    cta: "Varaa majoitus",
    image: gasthausImg,
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <a href="#main-content" className="skip-to-content">
        Siirry sisältöön
      </a>

      {/* Top bar */}
      <div className="bg-muted/50 border-b border-border">
        <div className="container mx-auto px-4 py-2">
          <a
            href="https://wiurila.fi"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Takaisin wiurila.fi
          </a>
        </div>
      </div>

      {/* Header */}
      <header className="border-b border-border bg-card" role="banner">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-serif font-semibold text-primary">
                Wiurilan kartano
              </h1>
              <p className="text-muted-foreground mt-1">Varausjärjestelmä</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="container mx-auto px-4 py-8 flex-1" role="main">
        <div className="max-w-6xl mx-auto space-y-10">
          {/* Booking cards */}
          <section aria-labelledby="booking-section-title">
            <div className="text-center mb-8 animate-fade-up">
              <h2 id="booking-section-title" className="text-3xl font-serif font-semibold mb-2">
                Tervetuloa varaamaan
              </h2>
              <p className="text-muted-foreground">
                Valitse palvelu, jonka haluat varata
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {bookingTypes.map((type, i) => (
                <Card
                  key={type.title}
                  className="h-full shadow-card hover:shadow-hover transition-shadow duration-300"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <CardHeader className="text-center">
                    <div className="w-14 h-14 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                      <type.icon className="h-7 w-7 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{type.title}</CardTitle>
                    <CardDescription>{type.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Link to={type.link}>
                      <Button variant="default" className="w-full">
                        {type.cta}
                      </Button>
                    </Link>
                    <div className="w-full aspect-[4/3] rounded-lg overflow-hidden">
                      <img
                        src={type.image}
                        alt={type.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Info */}
          <div className="text-center text-sm text-muted-foreground">
            <p>Varauspyynnöt käsitellään arkipäivisin.</p>
            <p className="mt-3 font-medium text-foreground">
              Kiireellisissä asioissa ota yhteyttä suoraan:
            </p>
            <div className="mt-1 flex flex-wrap justify-center gap-x-1 gap-y-1 items-center">
              <a href="https://wiurila.fi" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline whitespace-nowrap">www.wiurila.fi</a>
              <span className="text-muted-foreground">•</span>
              <a href="tel:+358400121900" className="text-primary hover:underline whitespace-nowrap">+358 400 121 900</a>
              <span className="text-muted-foreground">•</span>
              <a href="mailto:wiurila@wiurila.fi" className="text-primary hover:underline whitespace-nowrap">wiurila@wiurila.fi</a>
              <span className="text-muted-foreground">•</span>
              <span className="whitespace-nowrap">Viurilantie 126, Salo</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-auto" role="contentinfo">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col items-center gap-2">
            <Link to="/henkilokunta">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                <Lock className="h-4 w-4" />
                Henkilökunta
              </Button>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
