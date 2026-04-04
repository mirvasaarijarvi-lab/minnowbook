import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Rocket } from "lucide-react";
import { useT } from "@/contexts/I18nContext";

interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
}

const OnboardingChecklist = ({ onNavigate }: { onNavigate?: (view: string) => void }) => {
  const { tenantId } = useTenant();
  const t = useT();

  const { data: items } = useQuery({
    queryKey: ["onboarding-checklist", tenantId],
    queryFn: async (): Promise<ChecklistItem[]> => {
      if (!tenantId) return [];

      const [resourcesRes, hoursRes, settingsRes] = await Promise.all([
        supabase.from("resources").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        supabase.from("tenant_opening_hours").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        supabase.from("tenant_settings" as any).select("business_name, logo_url, business_email").eq("tenant_id", tenantId).maybeSingle(),
      ]);

      const settings = settingsRes.data as any;

      return [
        { key: "resource", label: "Add your first resource", done: (resourcesRes.count ?? 0) > 0 },
        { key: "hours", label: "Set opening hours", done: (hoursRes.count ?? 0) > 0 },
        { key: "branding", label: "Upload your logo", done: !!settings?.logo_url },
        { key: "email", label: "Set business email", done: !!settings?.business_email },
      ];
    },
    enabled: !!tenantId,
    staleTime: 120_000,
  });

  if (!items) return null;
  const completed = items.filter((i) => i.done).length;
  const total = items.length;
  const pct = Math.round((completed / total) * 100);

  // Hide if everything is done
  if (completed === total) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          <CardTitle className="font-serif text-base">Get Started</CardTitle>
          <span className="ml-auto text-sm font-medium text-primary">{pct}%</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={pct} className="h-2" />
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-2 text-sm">
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className={item.done ? "text-muted-foreground line-through" : "text-foreground"}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

export default OnboardingChecklist;
