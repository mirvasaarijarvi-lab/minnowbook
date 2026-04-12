import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, MessageSquare } from "lucide-react";
import { useT } from "@/contexts/I18nContext";

interface PublicReviewsProps {
  tenantId: string;
  siteId: string | null;
  primaryColor: string;
  accentColor: string;
}

const PublicReviews = ({ tenantId, siteId, primaryColor, accentColor }: PublicReviewsProps) => {
  const t = useT();

  const { data: reviews = [] } = useQuery({
    queryKey: ["public-reviews", tenantId, siteId],
    queryFn: async () => {
      let query = supabase
        .from("guest_reviews_public" as any)
        .select("id, guest_name, rating, comment, created_at")
        .eq("tenant_id", tenantId)
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(6);
      if (siteId) {
        query = query.eq("site_id", siteId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  if (reviews.length === 0) return null;

  const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-serif flex items-center gap-2" style={{ color: primaryColor }}>
          <MessageSquare className="h-5 w-5" />
          {t("booking.guestReviews" as any) || "Guest Reviews"}
        </CardTitle>
        <div className="flex items-center gap-2">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className="h-4 w-4"
                fill={s <= Math.round(avgRating) ? accentColor : "none"}
                stroke={s <= Math.round(avgRating) ? accentColor : "#d1d5db"}
              />
            ))}
          </div>
          <span className="text-sm text-muted-foreground">
            {avgRating.toFixed(1)} ({reviews.length})
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.id} className="p-3 rounded-lg border border-border">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium" style={{ color: primaryColor }}>
                  {review.guest_name}
                </span>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className="h-3 w-3"
                      fill={s <= review.rating ? accentColor : "none"}
                      stroke={s <= review.rating ? accentColor : "#d1d5db"}
                    />
                  ))}
                </div>
              </div>
              {review.comment && (
                <p className="text-sm text-muted-foreground">{review.comment}</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default PublicReviews;
