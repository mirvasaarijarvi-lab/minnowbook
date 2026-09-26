import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/I18nContext";
import { useTierGate } from "@/hooks/useTierGate";
import { STAFF_LABELS, staffLang } from "@/lib/staffing/labels";
import ShiftListTab from "./ShiftListTab";
import StaffingNeedsPanel from "./StaffingNeedsPanel";
import StaffingSetupGuide from "./StaffingSetupGuide";

export default function StaffingTab() {
  const { language } = useLanguage();
  const lang = staffLang(language);
  const L = STAFF_LABELS[lang];
  const needsLocked = useTierGate().isGated("basic");
  const [tab, setTab] = useState("shifts");
  return (
    <div className="space-y-3">
      <StaffingSetupGuide lang={lang} onGoToShifts={() => setTab("shifts")} />
      <Tabs value={tab} onValueChange={setTab} className="space-y-3">
        <TabsList className="no-print">
          <TabsTrigger value="shifts">{L.tabShifts}</TabsTrigger>
          <TabsTrigger value="needs">{L.tabNeeds}</TabsTrigger>
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
      </Tabs>
    </div>
  );
}
