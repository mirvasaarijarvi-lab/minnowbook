import { describe, expect, it } from "vitest";
import {
  buildSiteHistory,
  changeAffectsSite,
  readSnapshot,
} from "./accessReviewHistory";

const r = (id: string, at: string, users: string[], staff: string[]) => ({
  id,
  site_id: "S",
  accepted_by: "boss",
  accepted_at: at,
  snapshot: { users, staff },
});

describe("buildSiteHistory", () => {
  it("diffs each review against the next one and the newest against now", () => {
    const h = buildSiteHistory(
      "S",
      [
        r("old", "2026-01-01T00:00:00Z", ["a", "b"], ["x"]),
        r("new", "2026-02-01T00:00:00Z", ["a", "c"], ["x", "y"]),
        { ...r("other", "2026-03-01T00:00:00Z", [], []), site_id: "T" },
      ],
      { users: ["a"], staff: ["y"] },
      [
        {
          id: "q1",
          site_id: "S",
          subject_name: "B",
          note: "remove",
          status: "done",
          resolved_at: "2026-01-15T00:00:00Z",
        },
        {
          id: "q2",
          site_id: "S",
          subject_name: "C",
          note: "late",
          status: "dismissed",
          resolved_at: "2026-02-10T00:00:00Z",
        },
      ],
    );
    expect(h.map((e) => e.review.id)).toEqual(["new", "old"]);
    expect(h[0]).toMatchObject({
      untilAt: null,
      usersAdded: [],
      usersRemoved: ["c"],
      staffAdded: [],
      staffRemoved: ["x"],
    });
    expect(h[0].requests.map((q) => q.id)).toEqual(["q2"]);
    expect(h[1]).toMatchObject({
      untilAt: "2026-02-01T00:00:00Z",
      usersAdded: ["c"],
      usersRemoved: ["b"],
      staffAdded: ["y"],
      staffRemoved: [],
    });
    expect(h[1].requests.map((q) => q.id)).toEqual(["q1"]);
  });

  it("tolerates malformed snapshots", () => {
    expect(readSnapshot(null)).toEqual({ users: [], staff: [] });
    expect(readSnapshot({ users: [1, "a"] })).toEqual({
      users: ["a"],
      staff: [],
    });
  });
});

describe("location changes in history", () => {
  const c = (
    id: string,
    at: string,
    old: string | null,
    nw: string | null,
    action = "staff_moved",
  ) => ({
    id,
    action,
    subject_id: "p",
    subject_name: "P",
    old_site_id: old,
    new_site_id: nw,
    changed_by: "boss",
    changed_at: at,
  });
  it("matches changes touching the location or all locations", () => {
    expect(changeAffectsSite(c("1", "", "S", "T"), "S")).toBe(true);
    expect(changeAffectsSite(c("2", "", "T", null), "S")).toBe(true);
    expect(changeAffectsSite(c("3", "", "T", "U"), "S")).toBe(false);
    expect(changeAffectsSite(c("4", "", null, "T", "signin_added"), "S")).toBe(
      false,
    );
    expect(
      changeAffectsSite(c("5", "", "S", null, "signin_removed"), "S"),
    ).toBe(true);
  });
  it("puts each change under the review it follows", () => {
    const h = buildSiteHistory(
      "S",
      [
        r("old", "2026-01-01T00:00:00Z", [], []),
        r("new", "2026-02-01T00:00:00Z", [], []),
      ],
      { users: [], staff: [] },
      [],
      [
        c("b", "2026-02-05T00:00:00Z", "S", "T"),
        c("a", "2026-01-05T00:00:00Z", "T", "S"),
        c("x", "2025-12-01T00:00:00Z", "S", "T"),
      ],
    );
    expect(h[0].changes.map((x) => x.id)).toEqual(["b"]);
    expect(h[1].changes.map((x) => x.id)).toEqual(["a"]);
  });
});
