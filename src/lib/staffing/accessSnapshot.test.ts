import { describe, expect, it } from "vitest";
import { accessSnapshot } from "./accessSnapshot";

describe("accessSnapshot", () => {
  const users = [
    { user_id: "u-owner", role: "owner" },
    { user_id: "u-staff-a", role: "staff" },
    { user_id: "u-staff-b", role: "staff" },
    { user_id: "u-admin", role: "admin" },
  ];
  const siteUsers = [{ site_id: "A", user_id: "u-staff-a" }];
  const staff = [
    { id: "m3", site_ids: ["A", "B"], site_id: "A" },
    { id: "m1", site_ids: [], site_id: null },
    { id: "m2", site_ids: ["B"], site_id: "B" },
  ];

  it("includes managers everywhere and staff sign-ins only at assigned sites", () => {
    expect(accessSnapshot("A", users, siteUsers, staff).users).toEqual([
      "u-admin",
      "u-owner",
      "u-staff-a",
    ]);
    expect(accessSnapshot("B", users, siteUsers, staff).users).toEqual([
      "u-admin",
      "u-owner",
    ]);
  });

  it("includes shift staff at the site or at all locations, sorted", () => {
    expect(accessSnapshot("A", users, siteUsers, staff).staff).toEqual([
      "m1",
      "m3",
    ]);
    expect(accessSnapshot("B", users, siteUsers, staff).staff).toEqual([
      "m1",
      "m2",
      "m3",
    ]);
  });
});
