import { describe, expect, it } from "vitest";
import { buildSiteHistory, readSnapshot } from "./accessReviewHistory";

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
