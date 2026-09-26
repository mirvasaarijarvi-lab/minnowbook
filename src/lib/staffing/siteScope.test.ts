import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression: staffing needs (and payroll by date) count only shift lists for
 * the selected location plus lists covering all locations (site_id null).
 * A stand-in database applies the same filters PostgREST would.
 */
type Row = {
  tenant_id: string;
  date: string;
  start_time: string;
  end_time: string;
  actual_start_time: null;
  actual_end_time: null;
  code: null;
  shift_slots: {
    id: string;
    staff_member_id: string;
    role_key: string;
    shift_periods: { site_id: string | null };
  };
};

const T = "tenant-1";
const DAY = "2026-10-05";
const mk = (
  id: string,
  site: string | null,
  start: string,
  tenant = T,
): Row => ({
  tenant_id: tenant,
  date: DAY,
  start_time: start,
  end_time: "18:00",
  actual_start_time: null,
  actual_end_time: null,
  code: null,
  shift_slots: {
    id,
    staff_member_id: `m-${id}`,
    role_key: "waiter",
    shift_periods: { site_id: site },
  },
});

let rows: Row[] = [];
const calls: { or?: [string, any] } = {};

function builder() {
  const eqs: [string, string][] = [];
  const ranges: [string, string, string][] = [];
  let orFilter: string | null = null;
  const b: any = {
    select: () => b,
    order: () => b,
    eq: (c: string, v: string) => (eqs.push([c, v]), b),
    gte: (c: string, v: string) => (ranges.push([c, ">=", v]), b),
    lte: (c: string, v: string) => (ranges.push([c, "<=", v]), b),
    or: (f: string, o: any) => {
      calls.or = [f, o];
      expect(o?.referencedTable).toBe("shift_slots.shift_periods");
      orFilter = f;
      return b;
    },
    then: (res: any) => {
      let out = rows.filter((r) => eqs.every(([c, v]) => (r as any)[c] === v));
      out = out.filter((r) =>
        ranges.every(([c, op, v]) =>
          op === ">=" ? (r as any)[c] >= v : (r as any)[c] <= v,
        ),
      );
      if (orFilter) {
        const parts = orFilter.split(",");
        out = out.filter((r) => {
          const s = r.shift_slots.shift_periods.site_id;
          return parts.some((p) =>
            p === "site_id.is.null" ? s === null : p === `site_id.eq.${s}`,
          );
        });
      }
      return Promise.resolve({ data: out, error: null }).then(res);
    },
  };
  return b;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => builder() },
}));

const load = () => import("@/hooks/useShiftList");

beforeEach(() => {
  delete calls.or;
  rows = [
    mk("a", "site-A", "08:00"),
    mk("b", "site-B", "09:00"),
    mk("all", null, "10:00"),
    mk("other", "site-A", "11:00", "tenant-2"),
  ];
});

describe("staffing needs location scope", () => {
  it("counts the selected location's lists and all-locations lists only", async () => {
    const { fetchShiftsOnDate } = await load();
    const got = await fetchShiftsOnDate(T, DAY, "site-A");
    expect(got.map((r) => r.start_time).sort()).toEqual(["08:00", "10:00"]);
  });

  it("never includes another location's lists", async () => {
    const { fetchShiftsOnDate } = await load();
    const got = await fetchShiftsOnDate(T, DAY, "site-B");
    expect(got.map((r) => r.start_time).sort()).toEqual(["09:00", "10:00"]);
  });

  it("with no location selected, counts every list of the business", async () => {
    const { fetchShiftsOnDate } = await load();
    const got = await fetchShiftsOnDate(T, DAY, null);
    expect(calls.or).toBeUndefined();
    expect(got).toHaveLength(3);
  });

  it("never mixes in another business's lists", async () => {
    const { fetchShiftsOnDate } = await load();
    const got = await fetchShiftsOnDate(T, DAY, "site-A");
    expect(got.some((r) => r.start_time === "11:00")).toBe(false);
  });

  it("payroll by date uses the same location rule", async () => {
    const { fetchPayrollRange } = await load();
    const groups = await fetchPayrollRange(T, DAY, DAY, "site-A");
    expect(groups.map((g) => g.staff_member_id).sort()).toEqual([
      "m-a",
      "m-all",
    ]);
  });
});

describe("periodInSiteScope (shift list picker)", () => {
  it("applies the same rule in the browser", async () => {
    const { periodInSiteScope } = await import("./siteScope");
    expect(periodInSiteScope("site-A", "site-A")).toBe(true);
    expect(periodInSiteScope("site-A", null)).toBe(true);
    expect(periodInSiteScope("site-A", "site-B")).toBe(false);
    expect(periodInSiteScope(null, "site-B")).toBe(true);
  });
});

describe("memberInListScope", () => {
  it("offers a location's list only its own and all-locations staff", () => {
    expect(memberInListScope("a", "a")).toBe(true);
    expect(memberInListScope("a", null)).toBe(true);
    expect(memberInListScope("a", "b")).toBe(false);
  });
  it("offers an all-locations list everyone", () => {
    expect(memberInListScope(null, "a")).toBe(true);
    expect(memberInListScope(null, null)).toBe(true);
  });
});
