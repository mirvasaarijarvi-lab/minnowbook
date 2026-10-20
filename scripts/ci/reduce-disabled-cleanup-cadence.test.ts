import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "scripts/ci/reduce-disabled-cleanup-cadence.sql"),
  "utf8",
);

describe("less frequent disabled test cleanup", () => {
  it("schedules the existing job once weekly on Sunday at 03:15 UTC", () => {
    expect(sql.match(/schedule\s*:=\s*'([^']+)'/)?.[1]).toBe("15 3 * * 0");
    expect(sql.match(/jobname\s*=\s*'([^']+)'/)?.[1]).toBe(
      "test-reservation-cleanup-daily",
    );
  });

  it("only changes cadence when the most recent cleanup configuration is disabled", () => {
    expect(sql).toMatch(/AND NOT COALESCE\(\(\s*SELECT is_enabled/);
    expect(sql).toMatch(/ORDER BY updated_at DESC\s+LIMIT 1/);
    expect(sql).not.toMatch(/cron\.(unschedule|schedule)\(/);
  });
});
