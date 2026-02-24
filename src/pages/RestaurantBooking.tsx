import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const RestaurantBooking = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card" role="banner">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Takaisin
          </Link>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8" role="main">
        <Card className="max-w-2xl mx-auto shadow-card">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Pöytävaraus</CardTitle>
            <CardDescription>Ravintola Sigrid — varauslomake tulossa pian</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground">
              Tämä sivu rakennetaan pian. Voit ottaa yhteyttä suoraan:
              <br />
              <a href="tel:+358400121900" className="text-primary hover:underline">+358 400 121 900</a>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default RestaurantBooking;
