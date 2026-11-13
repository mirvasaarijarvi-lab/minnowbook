import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
const state = vi.hoisted(() => ({ start: "2020-01-01" as string | null, end: "2020-02-01" as string | null }));
vi.mock("@/hooks/useTenant", () => ({ useTenant: () => ({ tenant: { sample_start_date: state.start, sample_end_date: state.end, subscription_status: "trialing" } }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ isSystemAdmin: false }) }));
import { useSamplePeriod } from "./useSamplePeriod";
describe("expired sample recovery", () => {
  it("does not treat the default trialing label as proof of a paid subscription", () => {
    state.start = "2020-01-01";
    state.end = "2020-02-01";
    expect(renderHook(useSamplePeriod).result.current.isBlocked).toBe(true);
  });
  it("restores access after verification clears the expired sample", () => {
    state.start = null;
    state.end = null;
    const { result } = renderHook(useSamplePeriod);
    expect(result.current.isBlocked).toBe(false);
    expect(result.current.isReadOnly).toBe(false);
  });
});