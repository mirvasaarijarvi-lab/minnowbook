import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Heart, MessageSquareHeart, Check } from "lucide-react";

const emojis = [
  { value: 1, emoji: "😞", label: "Poor" },
  { value: 2, emoji: "😕", label: "Fair" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "😊", label: "Good" },
  { value: 5, emoji: "🤩", label: "Amazing" },
];

const BetaFeedbackCard = () => {
  const { user } = useAuth();
  const { tenant, tenantId } = useTenant();
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Only show for tenants on a sample/trial period
  const isBetaTenant =
    tenant?.subscription_status === "trialing" &&
    !!(tenant as any)?.sample_start_date &&
    !!(tenant as any)?.sample_end_date;

  // Check if the user already submitted feedback today
  const { data: recentFeedback } = useQuery({
    queryKey: ["beta-feedback-recent", user?.id, tenantId],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("beta_feedback")
        .select("id")
        .eq("user_id", user!.id)
        .gte("created_at", today + "T00:00:00Z")
        .limit(1);
      return (data ?? []).length > 0;
    },
    enabled: !!user?.id && !!tenantId && isBetaTenant,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!rating || !tenantId || !user?.id) return;
      const { error } = await supabase.from("beta_feedback").insert({
        tenant_id: tenantId,
        user_id: user.id,
        rating,
        comment: comment.trim() || null,
        page_context: window.location.pathname,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({ title: "Thank you!", description: "Your feedback helps us improve." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (!isBetaTenant || recentFeedback === true) return null;
  if (submitted) {
    return (
      <Card className="border-accent/30">
        <CardContent className="pt-6 pb-5">
          <div className="flex items-center gap-3 text-accent">
            <Check className="h-5 w-5" />
            <p className="text-sm font-medium">Thanks for your feedback today!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-accent/20 bg-gradient-to-br from-card to-accent/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-serif flex items-center gap-2">
          <MessageSquareHeart className="h-4 w-4 text-accent" />
          How's your experience so far?
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Your feedback as a beta tester is incredibly valuable to us.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Emoji rating */}
        <div className="flex items-center justify-between gap-1">
          {emojis.map((e) => (
            <button
              key={e.value}
              onClick={() => setRating(e.value)}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${
                rating === e.value
                  ? "bg-accent/15 ring-2 ring-accent scale-110"
                  : "hover:bg-accent/5 hover:scale-105"
              }`}
            >
              <span className="text-2xl">{e.emoji}</span>
              <span className="text-[10px] text-muted-foreground font-medium">{e.label}</span>
            </button>
          ))}
        </div>

        {/* Comment */}
        {rating !== null && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <Textarea
              placeholder="Anything specific you'd like to share? (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 1000))}
              rows={3}
              className="resize-none text-sm"
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{comment.length}/1000</span>
              <Button
                size="sm"
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
                className="gap-1.5"
              >
                <Heart className="h-3.5 w-3.5" />
                {submitMutation.isPending ? "Sending..." : "Send Feedback"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BetaFeedbackCard;
