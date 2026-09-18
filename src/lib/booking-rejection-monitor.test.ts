import { describe, expect, it } from "vitest";
import {
  rejectionCodeFromReasons,
  summarizeRejections,
  totalRejections,
} from "./booking-rejection-monitor";

describe("rejectionCodeFromReasons", () => {
  it("reads the tagged error code", () => {
    expect(
      rejectionCodeFromReasons(["[error_code:OCCASION_FULL]", "[OCCASION_REFUSED] full"]),
    ).toBe("OCCASION_FULL");
  });

  it("returns null when there is no tag", () => {
    expect(rejectionCodeFromReasons(["[SOFT_WARNING] busy"])).toBeNull();
    expect(rejectionCodeFromReasons(null)).toBeNull();
    expect(rejectionCodeFromReasons("not an array")).toBeNull();
  });
});

describe("summarizeRejections", () => {
  it("counts per code and keeps the newest occurrence", () => {
    const rows = [
      { reasons: ["[error_code:OCCASION_FULL]"], created_at: "2026-09-01T10:00:00Z" },
      { reasons: ["[error_code:OCCASION_FULL]"], created_at: "2026-09-03T10:00:00Z" },
      {
        reasons: ["[error_code:OCCASION_SEATING_UNAVAILABLE]"],
        created_at: "2026-09-02T10:00:00Z",
      },
    ];
    const summary = summarizeRejections(rows);
    expect(summary[0]).toEqual({
      code: "OCCASION_FULL",
      count: 2,
      lastSeen: "2026-09-03T10:00:00Z",
    });
    expect(summary[1].code).toBe("OCCASION_SEATING_UNAVAILABLE");
    expect(totalRejections(rows)).toBe(3);
  });

  it("groups untagged rows instead of dropping them", () => {
    const summary = summarizeRejections([{ reasons: ["nothing useful"], created_at: null }]);
    expect(summary).toEqual([{ code: "UNTAGGED", count: 1, lastSeen: null }]);
  });

  it("handles an empty log", () => {
    expect(summarizeRejections([])).toEqual([]);
    expect(totalRejections([])).toBe(0);
  });
});
