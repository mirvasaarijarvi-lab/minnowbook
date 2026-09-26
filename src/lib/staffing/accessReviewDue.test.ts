import { describe, it, expect } from "vitest";
import { reviewDue, reviewReminders } from "./accessReviewDue";
import { normalizeStaffingSettings } from "./staffingNeeds";

const NOW = new Date("2026-09-26T12:00:00Z");

describe("reviewDue", () => {
  it("never reviewed", () => {
    expect(reviewDue(null, 90, NOW).state).toBe("never");
  });
  it("recent review is fine", () => {
    expect(reviewDue("2026-09-01T12:00:00Z", 90, NOW).state).toBe("ok");
  });
  it("due within 14 days", () => {
    const d = reviewDue("2026-07-05T12:00:00Z", 90, NOW); // due 3.10.
    expect(d.state).toBe("dueSoon");
    expect(d.dueAt?.toISOString()).toBe("2026-10-03T12:00:00.000Z");
  });
  it("overdue counts whole days past due", () => {
    const d = reviewDue("2026-06-18T12:00:00Z", 90, NOW); // due 16.9.
    expect(d.state).toBe("overdue");
    expect(d.daysOverdue).toBe(10);
  });
  it("respects the interval", () => {
    expect(reviewDue("2026-06-18T12:00:00Z", 180, NOW).state).toBe("ok");
  });
});

describe("reviewReminders", () => {
  it("lists only locations needing attention, most urgent first", () => {
    const sites = [
      { id: "a", name: "Fine" },
      { id: "b", name: "Soon" },
      { id: "c", name: "Never" },
      { id: "d", name: "Late" },
      { id: "e", name: "Very late" },
    ];
    const reviews = [
      { site_id: "a", accepted_at: "2026-01-01T00:00:00Z" },
      { site_id: "a", accepted_at: "2026-09-20T00:00:00Z" }, // latest wins
      { site_id: "b", accepted_at: "2026-07-05T12:00:00Z" },
      { site_id: "d", accepted_at: "2026-06-18T12:00:00Z" },
      { site_id: "e", accepted_at: "2026-01-01T12:00:00Z" },
    ];
    expect(reviewReminders(sites, reviews, 90, NOW).map((r) => r.siteId)).toEqual([
      "e",
      "d",
      "c",
      "b",
    ]);
  });
});

describe("accessReviewDays setting", () => {
  it("defaults to 90 and clamps bad values", () => {
    expect(normalizeStaffingSettings(null).accessReviewDays).toBe(90);
    expect(normalizeStaffingSettings({ accessReviewDays: 30 }).accessReviewDays).toBe(30);
    expect(normalizeStaffingSettings({ accessReviewDays: 2 }).accessReviewDays).toBe(90);
    expect(normalizeStaffingSettings({ accessReviewDays: "x" }).accessReviewDays).toBe(90);
  });
});
