import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "drizzle/migrations/0050_restrict_dashboard_plan_diagnostics.sql",
  "utf8",
);

describe("dashboard plan diagnostics access", () => {
  for (const name of [
    "explain_reservations_dashboard",
    "analyze_reservations_dashboard",
  ]) {
    it(`denies browser access and preserves service access for ${name}`, () => {
      expect(sql).toContain(
        `REVOKE EXECUTE ON FUNCTION public.${name}(uuid, integer) FROM PUBLIC, anon, authenticated;`,
      );
      expect(sql).toContain(
        `GRANT EXECUTE ON FUNCTION public.${name}(uuid, integer) TO service_role;`,
      );
    });
  }

  it("changes only the two selected function ACLs", () => {
    const statements = sql
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);
    expect(statements).toHaveLength(4);
    for (const statement of statements) {
      expect(statement).toMatch(
        /^(?:REVOKE|GRANT) EXECUTE ON FUNCTION public\.(?:explain|analyze)_reservations_dashboard\(uuid, integer\) /,
      );
    }
  });
});
