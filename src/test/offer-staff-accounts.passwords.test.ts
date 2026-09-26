/**
 * Repeated end-to-end runs must keep the same passwords for both staff
 * logins. A fake backend records every call the login setup makes across
 * several runs, and the test fails if a password is ever set on an existing
 * login, or if a login is created again once it exists.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type Call = { fn: string; args: any };
const calls: Call[] = [];
const users = new Map<string, { id: string; password: string }>();
let memberships: { user_id: string; tenant_id: string }[] = [];

const TENANT = "tenant-1";

function fakeAdmin() {
  const record = (fn: string, args: any) => calls.push({ fn, args });
  const table = () => {
    const q: any = {
      select: () => q,
      eq: (_c: string, v: string) => {
        q._user = q._user ?? v;
        return q;
      },
      insert: (row: any) => {
        record("tenant_users.insert", row);
        memberships.push(row);
        return Promise.resolve({ error: null });
      },
      update: (row: any) => {
        record("tenant_users.update", row);
        return q;
      },
      then: (res: any) =>
        res({
          data: memberships
            .filter((m) => m.user_id === q._user)
            .map((m) => ({ ...m, role: "admin", is_approved: true })),
          error: null,
        }),
    };
    return q;
  };
  return {
    from: table,
    auth: {
      admin: {
        generateLink: async ({ email }: { email: string }) => {
          record("generateLink", { email });
          const u = users.get(email);
          if (!u) return { data: null, error: { message: "User not found" } };
          return {
            data: { user: { id: u.id }, properties: { hashed_token: "t" } },
            error: null,
          };
        },
        createUser: async (args: any) => {
          record("createUser", args);
          const id = `user-${users.size + 1}`;
          users.set(args.email, { id, password: args.password });
          return { data: { user: { id } }, error: null };
        },
        updateUserById: async (id: string, attrs: any) => {
          record("updateUserById", { id, ...attrs });
          for (const u of users.values())
            if (u.id === id && attrs.password) u.password = attrs.password;
          return { data: {}, error: null };
        },
        mfa: {
          listFactors: async () => ({ data: { factors: [] }, error: null }),
          deleteFactor: async () => ({ error: null }),
        },
      },
      verifyOtp: async () => ({ error: null }),
      signInWithPassword: async (args: any) => {
        record("signInWithPassword", args);
        return { error: null };
      },
    },
  };
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => fakeAdmin(),
}));

const run = async () => {
  const { ensureOfferStaffAccounts } =
    await import("../../e2e/fixtures/offer-staff-accounts");
  return ensureOfferStaffAccounts({
    url: "http://fake",
    anonKey: "anon",
    serviceKey: "service",
    tenantId: TENANT,
  });
};

describe("E2E staff logins keep their passwords between runs", () => {
  beforeEach(() => {
    calls.length = 0;
    users.clear();
    memberships = [];
  });

  it("creates each login once, then reuses it with the same password", async () => {
    await run();
    const created = calls.filter((c) => c.fn === "createUser");
    expect(created.map((c) => c.args.email).sort()).toEqual([
      "e2e-offer-staff-1@mimmobook.local",
      "e2e-offer-staff-2@mimmobook.local",
    ]);
    const firstPasswords = [...users.values()].map((u) => u.password);

    await run();
    await run();

    expect(calls.filter((c) => c.fn === "createUser")).toHaveLength(2);
    expect([...users.values()].map((u) => u.password)).toEqual(firstPasswords);
  });

  it("never changes or uses a password on any run", async () => {
    await run();
    await run();
    expect(
      calls.filter(
        (c) => c.fn === "updateUserById" && c.args.password !== undefined,
      ),
    ).toEqual([]);
    expect(calls.filter((c) => c.fn === "signInWithPassword")).toEqual([]);
  });

  it("the setup code has no way to set a password on an existing login", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("e2e/fixtures/offer-staff-accounts.ts", "utf8");
    expect(src).not.toMatch(/updateUserById|signInWithPassword/);
  });
});
