/**
 * Isolation across tenant switches inside a single session.
 *
 * Verifies that switching the active tenant without signing out cannot widen
 * access: each decision depends only on the current active tenant and the
 * current membership list, is identical no matter how the session got there,
 * and every cross-tenant write attempted after a switch is still refused.
 *
 * Fully offline: no database, no network.
 */
import { describe, expect, it } from "vitest";
import type { PostgrestError } from "@supabase/supabase-js";
import {
  decideSessionAccess,
  replaySwitches,
  revokeMembership,
  switchTenant,
  type TenantSession,
} from "./fixtures/tenant-session-switch";
import { ACTING_TENANT, TARGET_TENANT } from "./fixtures/tenant-access-matrix";
import { WRITE_DENIAL_MATRIX } from "./fixtures/tenant-write-denial-matrix";
import {
  expectReadDenied,
  expectWriteDenied,
  type QueryContext,
} from "./rls-assert";

const THIRD_TENANT = "44444444-4444-4444-8444-444444444444";
const STRANGER_TENANT = "55555555-5555-4555-8555-555555555555";

const denialError = {
  code: "42501",
  message: "permission denied for table",
  details: null,
  hint: null,
  name: "PostgrestError",
  toJSON: () => ({}),
} as unknown as PostgrestError;

function session(overrides: Partial<TenantSession> = {}): TenantSession {
  return {
    userId: "u-multi-tenant",
    activeTenantId: ACTING_TENANT,
    memberships: [
      { tenantId: ACTING_TENANT, role: "owner", isApproved: true },
      { tenantId: TARGET_TENANT, role: "staff", isApproved: true },
      { tenantId: THIRD_TENANT, role: "staff", isApproved: false },
    ],
    history: [],
    ...overrides,
  };
}

describe("tenant identity switching within one session", () => {
  it("allows only the tenant currently active", () => {
    const s = session();
    expect(decideSessionAccess(s, ACTING_TENANT).allowed).toBe(true);
    const denied = decideSessionAccess(s, TARGET_TENANT);
    expect(denied.allowed).toBe(false);
    expect(denied.reasons).toContain("tenant_mismatch");
  });

  it("moves access with the switch, in both directions", () => {
    const first = session();
    const second = switchTenant(first, TARGET_TENANT);
    expect(decideSessionAccess(second, TARGET_TENANT).allowed).toBe(true);
    expect(decideSessionAccess(second, ACTING_TENANT).allowed).toBe(false);

    const back = switchTenant(second, ACTING_TENANT);
    expect(decideSessionAccess(back, ACTING_TENANT).allowed).toBe(true);
    expect(decideSessionAccess(back, TARGET_TENANT).allowed).toBe(false);
  });

  it("never lets an earlier tenant's access carry over", () => {
    const decisions = replaySwitches(session(), [
      { check: ACTING_TENANT },
      { switchTo: TARGET_TENANT, check: ACTING_TENANT },
      { switchTo: TARGET_TENANT, check: TARGET_TENANT },
      { switchTo: ACTING_TENANT, check: TARGET_TENANT },
    ]);
    expect(decisions.map((d) => d.allowed)).toEqual([true, false, true, false]);
  });

  it("ignores a stale cached scope from the previous tenant", () => {
    const s = switchTenant(
      session({ cachedScopeTenantId: TARGET_TENANT }),
      ACTING_TENANT,
    );
    expect(s.cachedScopeTenantId).toBe(TARGET_TENANT);
    expect(decideSessionAccess(s, TARGET_TENANT).allowed).toBe(false);
    expect(decideSessionAccess(s, ACTING_TENANT).allowed).toBe(true);
  });

  it("denies a switch to a tenant the user never joined", () => {
    const s = switchTenant(session(), STRANGER_TENANT);
    const d = decideSessionAccess(s, STRANGER_TENANT);
    expect(d.allowed).toBe(false);
    expect(d.reasons).toContain("not_a_member");
    // and it does not silently keep the previous tenant's access either
    expect(decideSessionAccess(s, ACTING_TENANT).allowed).toBe(false);
  });

  it("denies a switch to a membership awaiting approval", () => {
    const s = switchTenant(session(), THIRD_TENANT);
    expect(decideSessionAccess(s, THIRD_TENANT)).toEqual({
      allowed: false,
      reasons: ["membership_not_approved"],
    });
  });

  it("denies immediately when the active membership is revoked mid-session", () => {
    const s = session();
    expect(decideSessionAccess(s, ACTING_TENANT).allowed).toBe(true);
    const revoked = revokeMembership(s, ACTING_TENANT);
    const d = decideSessionAccess(revoked, ACTING_TENANT);
    expect(d.allowed).toBe(false);
    expect(d.reasons).toContain("membership_revoked");
    // switching away and back cannot resurrect it
    const cycled = switchTenant(
      switchTenant(revoked, TARGET_TENANT),
      ACTING_TENANT,
    );
    expect(decideSessionAccess(cycled, ACTING_TENANT).allowed).toBe(false);
  });

  it("denies when no tenant is active yet", () => {
    const s = session({ activeTenantId: undefined, history: [] });
    for (const tenant of [ACTING_TENANT, TARGET_TENANT, THIRD_TENANT]) {
      const d = decideSessionAccess(s, tenant);
      expect(d.allowed).toBe(false);
      expect(d.reasons).toContain("no_active_tenant");
    }
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["blank", "   "],
    ["the word undefined", "undefined"],
    ["a slug", "my-tenant"],
    ["a number", 42],
    ["truncated uuid", "11111111-1111-4111-8111"],
    ["brace wrapped", "{11111111-1111-4111-8111-111111111111}"],
    ["injection payload", "' or 1=1 --"],
  ])("denies a switch whose tenant id is %s", (_label, value) => {
    const s = switchTenant(session(), value as string | undefined);
    const d = decideSessionAccess(s, value);
    expect(d.allowed).toBe(false);
    expect(d.reasons.length).toBeGreaterThan(0);
    expect(decideSessionAccess(s, ACTING_TENANT).allowed).toBe(false);
  });

  it("treats case and whitespace variants of the active tenant as the same tenant", () => {
    const s = switchTenant(session(), ` ${ACTING_TENANT.toUpperCase()} `);
    expect(decideSessionAccess(s, ACTING_TENANT).allowed).toBe(true);
    expect(decideSessionAccess(s, TARGET_TENANT).allowed).toBe(false);
  });

  it("returns the same decision no matter which path led to the tenant", () => {
    const direct = decideSessionAccess(
      switchTenant(session(), TARGET_TENANT),
      TARGET_TENANT,
    );
    const roundabout = decideSessionAccess(
      [STRANGER_TENANT, THIRD_TENANT, ACTING_TENANT, TARGET_TENANT].reduce(
        (acc, tenant) => switchTenant(acc, tenant),
        session(),
      ),
      TARGET_TENANT,
    );
    expect(roundabout).toEqual(direct);
  });

  it("repeats every decision identically across many switch cycles", () => {
    let s = session();
    const seen: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      s = switchTenant(s, i % 2 === 0 ? ACTING_TENANT : TARGET_TENANT);
      seen.push(
        JSON.stringify([
          decideSessionAccess(s, ACTING_TENANT),
          decideSessionAccess(s, TARGET_TENANT),
          decideSessionAccess(s, THIRD_TENANT),
        ]),
      );
    }
    expect(new Set(seen.filter((_, i) => i % 2 === 0)).size).toBe(1);
    expect(new Set(seen.filter((_, i) => i % 2 === 1)).size).toBe(1);
  });

  it("never mutates the session it is given", () => {
    const s = session();
    const snapshot = JSON.stringify(s);
    switchTenant(s, TARGET_TENANT);
    revokeMembership(s, ACTING_TENANT);
    decideSessionAccess(s, TARGET_TENANT);
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it("refuses every cross-tenant write attempted after a switch", () => {
    const s = switchTenant(session(), ACTING_TENANT);
    for (const c of WRITE_DENIAL_MATRIX) {
      const ctx: QueryContext = {
        table: c.table,
        operation: c.operation,
        attemptedQuery: c.attemptedQuery,
        actingTenantId: ACTING_TENANT,
        targetTenantId: TARGET_TENANT,
        scenario: `after switching to own tenant: ${c.label}`,
      };
      expect(decideSessionAccess(s, TARGET_TENANT).allowed).toBe(false);
      expect(() =>
        expectWriteDenied(ctx, { data: [], error: null }),
      ).not.toThrow();
      expect(() =>
        expectWriteDenied(ctx, { data: null, error: denialError }),
      ).not.toThrow();
      expect(() =>
        expectWriteDenied(ctx, { data: c.leakedRows, error: null }),
      ).toThrow(/RLS DENIAL FAILED/);
    }
  });

  it("refuses reads of the tenant left behind", () => {
    const s = switchTenant(session(), TARGET_TENANT);
    expect(decideSessionAccess(s, ACTING_TENANT).allowed).toBe(false);
    const ctx: QueryContext = {
      table: "reservations",
      operation: "SELECT",
      attemptedQuery:
        "from('reservations').select('*').eq('tenant_id', PREVIOUS)",
      actingTenantId: TARGET_TENANT,
      targetTenantId: ACTING_TENANT,
      scenario: "read of the tenant left behind after a switch",
    };
    expect(() =>
      expectReadDenied(ctx, { data: [], error: null }),
    ).not.toThrow();
    expect(() =>
      expectReadDenied(ctx, { data: null, error: denialError }),
    ).not.toThrow();
    expect(() =>
      expectReadDenied(ctx, {
        data: [{ id: "x", tenant_id: ACTING_TENANT }],
        error: null,
      }),
    ).toThrow(/RLS DENIAL FAILED/);
  });
});
