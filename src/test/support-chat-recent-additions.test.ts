import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { translations } from "@/i18n/translations";

const source = readFileSync(
  resolve(__dirname, "../../supabase/functions/support-chat/index.ts"),
  "utf8"
);

/**
 * Extract the "Recent additions" bullet list from the system prompt and return
 * the bold feature label of each bullet (e.g. "Guest Portal").
 *
 * The prompt format is:
 *   ### Recent additions (always mention if relevant)
 *   - **Guest Portal**: ...
 *   - **Waitlist**: ...
 *   ...
 */
function extractRecentAdditionFeatures(src: string): string[] {
  const start = src.indexOf("### Recent additions");
  if (start === -1) throw new Error("'### Recent additions' header not found");
  // Bound the section by the next top-level `### ` header (not `#### `, since
  // the Calendar Sync Q&A subsection lives inside this section) or the closing
  // "Keep answers concise" paragraph.
  const rest = src.slice(start);
  const endRel = rest.search(/\n### |\nKeep answers concise/);
  const section = endRel === -1 ? rest : rest.slice(0, endRel);

  const labels: string[] = [];
  for (const line of section.split("\n")) {
    // Match top-level bullets only: "- **Label**:" (no indent — sub-bullets
    // inside the Q&A flow are indented with spaces).
    const m = /^- \*\*([^*]+)\*\*\s*:/.exec(line);
    if (m) labels.push(m[1].trim());
  }
  return labels;
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
  const promptFeatures = extractRecentAdditionFeatures(source);
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
