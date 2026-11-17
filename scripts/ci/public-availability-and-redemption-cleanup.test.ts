import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "drizzle/migrations/0051_public_availability_status_and_redemption_cleanup.sql",
  "utf8",
);
const offerFn = readFileSync(
  "supabase/functions/send-offer-email/index.ts",
  "utf8",
);

describe("public availability exposes no booking totals", () => {
  it("returns only a busy/full status per day", () => {
    expect(sql).toContain("RETURNS TABLE(day date, day_status text)");
    expect(sql).not.toMatch(/reservation_count/);
  });
});

describe("redemption history cleanup", () => {
  it("cannot be run by visitors or signed-in users", () => {
    expect(sql).toContain(
      "REVOKE EXECUTE ON FUNCTION public.cleanup_old_redemption_events() FROM PUBLIC, anon, authenticated;",
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.cleanup_old_redemption_events() TO service_role;",
    );
  });
});

describe("archived offers revoke their PDF links", () => {
  it("stores offer PDFs under the offer id so they can be deleted on archive", () => {
    expect(offerFn).toContain("/offers/${safeOfferId}/");
    expect(offerFn).toContain('action === "revoke_pdf"');
    expect(offerFn).toMatch(/\.remove\(paths\)/);
  });
});
