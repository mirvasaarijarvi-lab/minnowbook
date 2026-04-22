/**
 * Regression tests guarding the staff-user-limit error pipeline.
 *
 * Two independent contracts:
 *
 *   1. Errors surfaced when staff creation is blocked must originate from
 *      the tier-based DB trigger `enforce_staff_user_limit` (which raises
 *      `'Tier "<tier>" allows at most <N> staff user(s). Upgrade your plan
 *      to add more.'`). `parseTierLimitError` must extract a tier and
 *      limit, and that limit must match the value the frontend's
 *      `getMaxStaffUsers(tier)` mirror returns — i.e. both layers agree
 *      on the cap (Basic=5, Professional=25, Business=unlimited).
 *
 *      Older messages that referenced a `max_staff_users` column directly
 *      (e.g. "Tenant max_staff_users limit reached") must NOT match —
 *      that legacy shape was removed and any reappearance would mean a
 *      regression to per-tenant column enforcement instead of the
 *      tier-driven trigger.
 *
 *   2. The app code (excluding `src/integrations/supabase/types.ts`,
 *      auto-generated migrations, and intentional comments referencing
 *      `get_tier_max_staff_users`) must contain no bare `max_staff_users`
 *      identifier that could imply a column lookup. If someone re-adds a
 *      `tenant.max_staff_users` read or a `select('max_staff_users')`,
 *      this test fails immediately.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parseTierLimitError } from "./tier-error-codes";
import { getMaxStaffUsers } from "./tier-limits";

// --- Contract 1: trigger message → parsed tier + limit -------------------

describe("staff-user-limit trigger errors", () => {
  // Messages must be byte-for-byte what `enforce_staff_user_limit` emits.
  // Keep this table in sync with `get_tier_max_staff_users` in the DB.
  const cases: Array<{ tier: string; limit: number }> = [
    { tier: "basic", limit: 5 },
    { tier: "professional", limit: 25 },
  ];

  for (const { tier, limit } of cases) {
    it(`parses the ${tier}-tier trigger message and matches getMaxStaffUsers`, () => {
      const triggerMessage =
        `Tier "${tier}" allows at most ${limit} staff user(s). ` +
        `Upgrade your plan to add more.`;

      const info = parseTierLimitError({ message: triggerMessage });

      // The error must be recognized as a staff-user limit failure.
      expect(info).not.toBeNull();
      expect(info!.code).toBe("STAFF_USER_LIMIT_REACHED");
      expect(info!.tier).toBe(tier);
      expect(info!.limit).toBe(limit);

      // And the frontend's tier→cap mirror must agree with the DB's cap.
      // If these ever diverge, the UI will show a misleading number while
      // the server keeps rejecting at a different threshold.
      expect(getMaxStaffUsers(tier)).toBe(limit);
    });
  }

  it("does NOT match a legacy max_staff_users column-style error", () => {
    // These shapes belong to the removed per-tenant `max_staff_users`
    // column enforcement. If they ever match again, the system has
    // regressed away from tier-based enforcement.
    const legacyMessages = [
      "Tenant max_staff_users limit reached",
      "max_staff_users exceeded for tenant",
      'column "max_staff_users" cannot be null',
    ];

    for (const msg of legacyMessages) {
      expect(
        parseTierLimitError({ message: msg }),
        `legacy message should not be classified as a tier error: ${msg}`,
      ).toBeNull();
    }
  });
});

// --- Contract 2: no legacy `max_staff_users` references in app code -----

describe("no legacy max_staff_users references", () => {
  // Anything outside `src/` is either generated (types.ts is inside src/
  // but allowlisted below) or out of scope for this guard.
  const ROOT = join(__dirname, "..");

  // Files that legitimately mention `max_staff_users` for documentation
  // purposes only, never as a column read.
  const ALLOWLIST = new Set<string>([
    // Generated types: the DB function `get_tier_max_staff_users` is
    // exposed here as a typed RPC. Substring-matches `max_staff_users`
    // but is only a function name, not a column.
    "integrations/supabase/types.ts",
    // This regression test itself contains the literal for matching.
    "lib/staff-limit-trigger.regression.test.ts",
  ]);

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        // Skip build artefacts.
        if (entry === "node_modules" || entry === "dist") continue;
        walk(full, out);
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
        out.push(full);
      }
    }
    return out;
  }

  it("no source file references the bare `max_staff_users` column outside the allowlist", () => {
    const files = walk(ROOT);
    const offenders: Array<{ file: string; line: number; text: string }> = [];

    for (const file of files) {
      const rel = relative(ROOT, file);
      if (ALLOWLIST.has(rel)) continue;

      const content = readFileSync(file, "utf8");
      if (!content.includes("max_staff_users")) continue;

      const lines = content.split("\n");
      lines.forEach((text, i) => {
        if (!text.includes("max_staff_users")) return;
        // Allow references that explicitly name the tier-based DB
        // function `get_tier_max_staff_users` or the helper mirror
        // `getMaxStaffUsers` (camelCase contains no underscore so it
        // never matches, but be explicit). Anything else is suspect.
        const stripped = text.replace(/get_tier_max_staff_users/g, "");
        if (!stripped.includes("max_staff_users")) return;
        offenders.push({ file: rel, line: i + 1, text: text.trim() });
      });
    }

    expect(
      offenders,
      `legacy max_staff_users references found:\n` +
        offenders
          .map((o) => `  ${o.file}:${o.line}  ${o.text}`)
          .join("\n"),
    ).toEqual([]);
  });
});
