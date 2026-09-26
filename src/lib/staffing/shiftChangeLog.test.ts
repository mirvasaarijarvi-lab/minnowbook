import { describe, it, expect } from "vitest";
import { describeShiftChange, changeAuthor, type ShiftChangeEntry } from "./shiftChangeLog";

const n = {
  member: (id: string) => ({ m1: "Helena Suonio", m2: "Pekka" } as Record<string, string>)[id],
  role: (k: string) => ({ waiter: "Vakitarjoilija" } as Record<string, string>)[k],
  slotLabel: () => "Helena Suonio",
};
const base: ShiftChangeEntry = { id: "1", entity: "shift", action: "update", slot_id: "s1", shift_date: "2026-09-22", old_data: null, new_data: null, changed_fields: null, changed_by_name: "Mimmi", created_at: "2026-09-26T10:00:00Z" };

describe("describeShiftChange", () => {
  it("planned time change", () => {
    const e = { ...base, old_data: { start_time: "10:00:00", end_time: "18:00:00", code: null }, new_data: { start_time: "12:00:00", end_time: "18:30:00", code: null }, changed_fields: ["start_time", "end_time"] };
    expect(describeShiftChange(e, "fi", n)).toBe("Helena Suonio · 22.9.2026: Suunniteltu 10-18 → 12-18:30");
  });
  it("new shift and day-off code", () => {
    expect(describeShiftChange({ ...base, action: "insert", new_data: { code: "V" } }, "fi", n)).toBe("Helena Suonio · 22.9.2026: Suunniteltu tyhjä → V");
  });
  it("actual hours", () => {
    const e = { ...base, old_data: { start_time: "10:00:00", end_time: "18:00:00" }, new_data: { start_time: "10:00:00", end_time: "18:00:00", actual_start_time: "10:00:00", actual_end_time: "19:15:00" }, changed_fields: ["actual_start_time", "actual_end_time"] };
    expect(describeShiftChange(e, "en", n)).toBe("Helena Suonio · 22.9.2026: Actual empty → 10-19:15");
  });
  it("worker and role on a row", () => {
    const e = { ...base, entity: "slot", old_data: { staff_member_id: "m2", role_key: null }, new_data: { staff_member_id: "m1", role_key: "waiter" }, changed_fields: ["staff_member_id", "role_key"] };
    expect(describeShiftChange(e, "fi", n)).toBe("Helena Suonio: Työntekijä: Pekka → Helena Suonio; Tehtävä: tyhjä → Vakitarjoilija");
  });
  it("list and row add/remove", () => {
    expect(describeShiftChange({ ...base, entity: "period", action: "insert", slot_id: null }, "fi", n)).toBe("Lista lisätty");
    expect(describeShiftChange({ ...base, entity: "slot", action: "delete" }, "sv", n)).toBe("Rad borttagen (Helena Suonio)");
  });
  it("author fallback", () => {
    expect(changeAuthor(base, "fi")).toBe("Mimmi");
    expect(changeAuthor({ ...base, changed_by_name: null }, "fi")).toBe("Tuntematon käyttäjä");
  });
});
