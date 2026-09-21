import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn(() => Promise.resolve({ data: null, error: null }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...(args as [])),
  },
}));

import { logReservationAccess, recordAuthFailure } from "./reservationAccessLog";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("logReservationAccess", () => {
  beforeEach(() => {
    rpc.mockClear();
    rpc.mockImplementation(() => Promise.resolve({ data: null, error: null }));
  });

  it("does nothing without a tenant", async () => {
    logReservationAccess({ tenantId: null, action: "view", recordCount: 5 });
    await flush();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("records the action, count and site", async () => {
    logReservationAccess({
      tenantId: "t1",
      action: "export",
      recordCount: 12.6,
      siteId: "s1",
    });
    await flush();
    expect(rpc).toHaveBeenCalledWith("log_reservation_access", {
      p_tenant_id: "t1",
      p_action: "export",
      p_record_count: 13,
      p_site_id: "s1",
    });
  });

  it("never sends a negative count", async () => {
    logReservationAccess({ tenantId: "t1", action: "view", recordCount: -4 });
    await flush();
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_record_count: 0 });
  });

  it("swallows backend failures", async () => {
    rpc.mockImplementation(() => Promise.reject(new Error("offline")));
    expect(() =>
      logReservationAccess({ tenantId: "t1", action: "view" }),
    ).not.toThrow();
    await flush();
  });
});

describe("recordAuthFailure", () => {
  beforeEach(() => {
    rpc.mockClear();
    rpc.mockImplementation(() => Promise.resolve({ data: null, error: null }));
  });

  it("sends the address and reason for masking server-side", async () => {
    recordAuthFailure("Mimmi@Example.com", "Invalid login credentials");
    await flush();
    const [fn, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(fn).toBe("record_auth_failure");
    expect(args.p_email).toBe("Mimmi@Example.com");
    expect(args.p_reason).toBe("Invalid login credentials");
  });

  it("truncates an overlong reason", async () => {
    recordAuthFailure("a@b.com", "x".repeat(500));
    await flush();
    const args = rpc.mock.calls[0][1] as Record<string, string>;
    expect(args.p_reason.length).toBe(200);
  });

  it("never throws on the sign-in screen", async () => {
    rpc.mockImplementation(() => Promise.reject(new Error("offline")));
    expect(() => recordAuthFailure("a@b.com", "nope")).not.toThrow();
    await flush();
  });
});
