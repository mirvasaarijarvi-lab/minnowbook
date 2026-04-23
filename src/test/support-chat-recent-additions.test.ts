import { describe, it, expect } from "vitest";
import { translations } from "@/i18n/translations";
import {
  prompt,
  extractSection,
  extractBoldBulletLabels,
} from "./utils/prompt-sections";

/**
 * Extract the "Recent additions" bullet list and return the bold feature
 * label of each top-level bullet (e.g. "Guest Portal"). Uses the shared
 * `extractSection` helper with `"### "` so the `#### Calendar Sync` child
 * subsection is included in the slice (its sub-bullets are filtered out
 * by `extractBoldBulletLabels` which only matches non-indented bullets).
 */
function extractRecentAdditionFeatures(src: string): string[] {
  const section = extractSection(src, "### Recent additions", "### ");
  return extractBoldBulletLabels(section);
}

/**
 * Recent features as surfaced in the dashboard UI.
 *
 * Source of truth: the "What's New" article (help.art10*) and the matching
 * quick guide (help.guide6A) in src/i18n/translations.ts. Whenever a recent
 * feature is added or removed from the prompt, it must also appear here so
 * the in-app guidebook keeps parity with what the chatbot can talk about.
 *
 * Each entry lists keywords that must appear in EITHER:
 *   - the prompt's bullet labels, OR
 *   - the English help.art10C* / help.guide6A copy.
 */
const RECENT_FEATURES: Array<{ name: string; keywords: RegExp }> = [
  { name: "Guest Portal", keywords: /Guest Portal/i },
  { name: "Waitlist", keywords: /Waitlist/i },
  { name: "Calendar sync (iCal feed)", keywords: /Calendar sync|iCal/i },
  { name: "CSV/PDF export", keywords: /CSV.*PDF|CSV\/PDF|export/i },
  { name: "Analytics charts", keywords: /Analytics charts|analytics chart/i },
  { name: "Onboarding checklist", keywords: /Onboarding checklist/i },
  { name: "Quick Actions FAB", keywords: /Quick Actions FAB/i },
  { name: "Dark mode", keywords: /Dark mode/i },
  { name: "Keyboard shortcuts modal", keywords: /Keyboard shortcuts/i },
  { name: "Login rate limiting", keywords: /Login rate limiting|rate limit/i },
  { name: "Audit log filters", keywords: /Audit log filters|audit-log filter/i },
  { name: "Backup status indicator", keywords: /Backup status/i },
  { name: "Public reviews/testimonials", keywords: /reviews|testimonial/i },
  { name: "Multi-language public booking", keywords: /Multi-language public booking|multi-language/i },
  { name: "Stripe revenue dashboard", keywords: /Stripe revenue/i },
];

describe("'Recent additions' prompt section ↔ dashboard UI parity", () => {
  const promptFeatures = extractRecentAdditionFeatures(prompt);
  const uiCopy = [
    translations.en["help.art10Title"],
    translations.en["help.art10Desc"],
    translations.en["help.art10C1"],
    translations.en["help.art10C2"],
    translations.en["help.art10C3"],
    translations.en["help.art10C4"],
    translations.en["help.guide6A"],
  ].join("\n");

  it("extracts at least one bullet from the prompt", () => {
    expect(promptFeatures.length).toBeGreaterThan(0);
  });

  it("the prompt bullet list matches the expected set of recent features", () => {
    expect(promptFeatures).toEqual(RECENT_FEATURES.map((f) => f.name));
  });

  it.each(RECENT_FEATURES)(
    "feature '$name' appears in the prompt bullets",
    ({ keywords }) => {
      expect(promptFeatures.join("\n")).toMatch(keywords);
    }
  );

  it.each(RECENT_FEATURES)(
    "feature '$name' is also surfaced in the dashboard 'What's New' copy",
    ({ keywords }) => {
      expect(uiCopy).toMatch(keywords);
    }
  );

  it("no orphan features in the prompt that the UI doesn't mention", () => {
    const orphans = promptFeatures.filter(
      (label) => !RECENT_FEATURES.some((f) => f.keywords.test(label))
    );
    expect(orphans).toEqual([]);
  });
});
