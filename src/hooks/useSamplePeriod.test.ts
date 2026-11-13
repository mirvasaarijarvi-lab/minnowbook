import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
const state = vi.hoisted(() => ({ status: "canceled" }));
vi.mock("@/hooks/useTenant", () => ({ useTenant: () => ({ tenant: { sample_start_date: "2020-01-01", sample_end_date: "2020-02-01", subscription_status: state.status } }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ isSystemAdmin: false }) }));
import { useSamplePeriod } from "./useSamplePeriod";
describe("paid subscription recovery from an expired sample", () => {
  it.each(["active", "trialing"])("restores access for a verified %s subscription", (status) => {
    state.status = status;
    const { result } = renderHook(useSamplePeriod);
    expect(result.current.isBlocked).toBe(false);
    expect(result.current.isReadOnly).toBe(false);
  });
  it("keeps expired canceled subscribers blocked", () => {
    state.status = "canceled";
    expect(renderHook(useSamplePeriod).result.current.isBlocked).toBe(true);
  });
});