import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";

const StaffLogin = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-card">
        <CardHeader className="text-center">
          <div className="w-14 h-14 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl">Henkilökunnan kirjautuminen</CardTitle>
          <CardDescription>Kirjautuminen otetaan käyttöön pian</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
            <ArrowLeft className="h-4 w-4" />
            Takaisin etusivulle
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffLogin;
