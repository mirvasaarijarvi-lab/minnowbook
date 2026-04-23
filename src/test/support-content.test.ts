import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { translations } from "@/i18n/translations";

const promptSource = readFileSync(
  resolve(__dirname, "../../supabase/functions/support-chat/index.ts"),
  "utf8"
);

describe("support chat — system prompt content", () => {
  it("includes the 'Recent additions' section header", () => {
    expect(promptSource).toContain("### Recent additions");
  });

  const recentBullets = [
    "Guest Portal",
    "Waitlist",
    "Calendar sync (iCal feed)",
    "CSV/PDF export",
    "Analytics charts",
    "Onboarding checklist",
    "Quick Actions FAB",
    "Dark mode",
    "Keyboard shortcuts modal",
    "Login rate limiting",
    "Audit log filters",
    "Backup status indicator",
    "Public reviews/testimonials",
    "Multi-language public booking",
    "Stripe revenue dashboard",
  ];

  for (const bullet of recentBullets) {
    it(`mentions recent feature: ${bullet}`, () => {
      expect(promptSource).toContain(bullet);
    });
  }

  it("includes the Calendar Sync Q&A flow that asks iCal vs Google", () => {
    expect(promptSource).toContain("#### Calendar Sync — Q&A flow");
    expect(promptSource).toMatch(/Always ask first/i);
    expect(promptSource).toMatch(/iCal subscription/);
    expect(promptSource).toMatch(/Google Calendar/);
  });

  it("references the Settings → Calendar Sync location", () => {
    expect(promptSource).toContain("Settings → Calendar Sync");
  });
});

describe("support chat — guidebook article keys", () => {
  // Mirrors articleDefs in DashboardSupportPanel — the panel reads these keys
  // dynamically, so a missing key would surface as a raw key in the UI.
  const ARTICLE_COUNT = 10;
  const CONTENT_PER_ARTICLE = 4;
  const GUIDE_COUNT = 6;
  const LANGUAGES = ["en", "fi", "sv"] as const;

  for (const lang of LANGUAGES) {
    const dict = translations[lang] as Record<string, string>;

    for (let n = 1; n <= ARTICLE_COUNT; n++) {
      it(`[${lang}] article ${n} has Title + Desc + ${CONTENT_PER_ARTICLE} content keys`, () => {
        expect(dict[`help.art${n}Title`]).toBeTruthy();
        expect(dict[`help.art${n}Desc`]).toBeTruthy();
        for (let c = 1; c <= CONTENT_PER_ARTICLE; c++) {
          expect(dict[`help.art${n}C${c}`]).toBeTruthy();
        }
      });
    }

    for (let n = 1; n <= GUIDE_COUNT; n++) {
      it(`[${lang}] quick guide ${n} has Q + A`, () => {
        expect(dict[`help.guide${n}Q`]).toBeTruthy();
        expect(dict[`help.guide${n}A`]).toBeTruthy();
      });
    }
  }

  it("'What's New' article (art10) mentions the key recent features", () => {
    const enArt10 = [
      translations.en["help.art10Title"],
      translations.en["help.art10Desc"],
      translations.en["help.art10C1"],
      translations.en["help.art10C2"],
      translations.en["help.art10C3"],
      translations.en["help.art10C4"],
    ].join(" ");
    expect(enArt10).toMatch(/Guest Portal/i);
    expect(enArt10).toMatch(/Waitlist/i);
    expect(enArt10).toMatch(/Calendar/i);
    expect(enArt10).toMatch(/dark mode/i);
  });

  it("guide 6 ('What's new') mentions multiple recent features", () => {
    const a = translations.en["help.guide6A"];
    expect(a).toMatch(/Guest Portal/i);
    expect(a).toMatch(/Waitlist/i);
    expect(a).toMatch(/Calendar/i);
  });
});
