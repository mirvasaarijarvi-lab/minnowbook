import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/I18nContext";
import { useTierGate } from "@/hooks/useTierGate";
import { useTenant } from "@/hooks/useTenant";
import { STAFF_LABELS, staffLang } from "@/lib/staffing/labels";
import ShiftListTab from "./ShiftListTab";
import StaffingNeedsPanel from "./StaffingNeedsPanel";
import StaffingSetupGuide from "./StaffingSetupGuide";
import AccessReviewPanel from "./AccessReviewPanel";
import AccessReviewReminder from "./AccessReviewReminder";
import { useAccessReviewReminders } from "@/hooks/useAccessReviewReminders";

const REVIEW_TAB = {
  en: "Access review",
  fi: "Käyttöoikeudet",
  sv: "Behörighetsgranskning",
};

export default function StaffingTab() {
  const { language } = useLanguage();
  const lang = staffLang(language);
  const L = STAFF_LABELS[lang];
  const needsLocked = useTierGate().isGated("basic");
  const { isOwner, isAdmin } = useTenant();
  const canReview = isOwner || isAdmin;
  const [tab, setTab] = useState("shifts");
  const urgentReviews = useAccessReviewReminders().filter(
    (r) => r.due.state !== "dueSoon",
  ).length;
  return (
    <div className="space-y-3">
      <StaffingSetupGuide lang={lang} onGoToShifts={() => setTab("shifts")} />
      {canReview && tab !== "access" && (
        <AccessReviewReminder lang={lang} onOpen={() => setTab("access")} />
      )}
      <Tabs value={tab} onValueChange={setTab} className="space-y-3">
        <TabsList className="no-print">
          <TabsTrigger value="shifts">{L.tabShifts}</TabsTrigger>
          <TabsTrigger value="needs">{L.tabNeeds}</TabsTrigger>
          {canReview && (
            <TabsTrigger value="access" className="gap-1.5">
              {REVIEW_TAB[lang]}
              {urgentReviews > 0 && (
                <span className="rounded-full bg-destructive px-1.5 text-xs leading-5 text-destructive-foreground">
                  {urgentReviews}
                </span>
              )}
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="shifts">
          <ShiftListTab lang={lang} />
        </TabsContent>
        <TabsContent value="needs">
          {needsLocked ? (
            <p className="text-sm text-muted-foreground">{L.upgradeNeeds}</p>
          ) : (
            <StaffingNeedsPanel lang={lang} />
          )}
        </TabsContent>
        {canReview && (
          <TabsContent value="access">
            <AccessReviewPanel lang={lang} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
