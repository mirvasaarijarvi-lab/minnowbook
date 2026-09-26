import { describe, it, expect } from "vitest";
import { filterShiftSlots } from "./shiftSlotFilter";

const slots = [
  { id: 1, staff_member_id: "a", role_key: "waiter" },
  { id: 2, staff_member_id: "b", role_key: "chef" },
  { id: 3, staff_member_id: null, role_key: "waiter" },
];
const names: Record<string, string> = { a: "Helena Suonio", b: "Jääskeläinen Pekka" };
const roles: Record<string, string> = { waiter: "Vakitarjoilija", chef: "Kokki" };
const run = (o: Parameters<typeof filterShiftSlots>[1]) => filterShiftSlots(slots, o, (i) => names[i], (k) => roles[k]).map((s) => s.id);

describe("filterShiftSlots", () => {
  it("returns all with no filters", () => expect(run({})).toEqual([1, 2, 3]));
  it("searches worker name, case/accent-insensitive", () => {
    expect(run({ query: "helena" })).toEqual([1]);
    expect(run({ query: "jaaskelainen" })).toEqual([2]);
  });
  it("searches role name", () => expect(run({ query: "tarjoil" })).toEqual([1, 3]));
  it("combines words across name and role", () => expect(run({ query: "suonio vaki" })).toEqual([1]));
  it("filters by role and member", () => {
    expect(run({ roleKey: "waiter" })).toEqual([1, 3]);
    expect(run({ memberId: "b" })).toEqual([2]);
    expect(run({ roleKey: "chef", query: "helena" })).toEqual([]);
  });
});
