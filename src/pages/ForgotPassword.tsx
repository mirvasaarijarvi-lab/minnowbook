import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail } from "lucide-react";
import Logo from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ForgotPassword = () => {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setSent(true);
      toast.success("Check your email for the reset link.");
    } catch (error: any) {
      toast.error(error.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 inline-block">
          <Logo variant="color" size="sm" />
        </Link>

        {sent ? (
          <div className="text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 mx-auto mb-6">
              <Mail className="h-8 w-8 text-accent" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-foreground mb-2">
              Check your email
            </h1>
            <p className="text-muted-foreground mb-6">
              We sent a password reset link to <strong>{email}</strong>. Click
              the link in the email to reset your password.
            </p>
            <Link to="/login">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-serif font-bold text-foreground mb-2">
              Reset your password
            </h1>
            <p className="text-muted-foreground mb-8">
              Enter your email and we'll send you a link to reset your password.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                variant="hero"
                size="lg"
                className="w-full"
                disabled={loading}
              >
                {loading ? "Sending..." : "Send reset link"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              <Link to="/login" className="text-accent font-medium hover:underline">
                <ArrowLeft className="h-3 w-3 inline mr-1" />
                Back to login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
