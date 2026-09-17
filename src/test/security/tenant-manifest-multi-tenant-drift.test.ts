/**
 * Multi-tenant manifest drift: several tenant environments are evaluated in
 * one run, each with a different drift state (healthy, lagging on migrations,
 * genuinely missing a table). The guard must judge each tenant on its own
 * schema view only.
 *
 * Fully offline: no database, no network, no live tenant pair.
 */
import { describe, it, expect } from "vitest";
import {
  classifyManifestDriftForTenants,
  staleTenantsError,
  pendingMigrationWarning,
  type TenantSchemaView,
} from "./fixtures/tenant-manifest-drift";

const MANIFEST = ["reservations", "resources", "booking_idempotency", "legacy_invoices"];
const DECLARED = ["reservations", "resources", "booking_idempotency"];

/** Tenant A is fully up to date. */
const healthy: TenantSchemaView = {
  tenant: "tenant-a-up-to-date",
  liveTables: ["reservations", "resources", "booking_idempotency", "legacy_invoices"],
};
/** Tenant B lags on migrations: booking_idempotency is not applied yet. */
const lagging: TenantSchemaView = {
  tenant: "tenant-b-migrations-pending",
  liveTables: ["reservations", "resources", "legacy_invoices"],
};
/** Tenant C really dropped legacy_invoices; no migration creates it. */
const stale: TenantSchemaView = {
  tenant: "tenant-c-table-dropped",
  liveTables: ["reservations", "resources", "booking_idempotency"],
};
/** Tenant D has both problems at once. */
const both: TenantSchemaView = {
  tenant: "tenant-d-both",
  liveTables: ["reservations", "resources"],
};

function classify(tenants: TenantSchemaView[]) {
  return classifyManifestDriftForTenants({
    manifestTables: MANIFEST,
    tenants,
    declaredInMigrations: DECLARED,
  });
}

describe("manifest drift across multiple tenants", () => {
  it("gives each tenant its own verdict in one run", () => {
    const result = classify([healthy, lagging, stale, both]);
    expect(result.perTenant.map((r) => `${r.tenant}=${r.verdict}`)).toEqual([
      "tenant-a-up-to-date=ok",
      "tenant-b-migrations-pending=pending",
      "tenant-c-table-dropped=stale",
      "tenant-d-both=stale",
    ]);
  });

  it("keeps each tenant's missing tables separate", () => {
    const [a, b, c, d] = classify([healthy, lagging, stale, both]).perTenant;
    expect(a.drift.missing).toEqual([]);
    expect(b.drift.pendingMigration).toEqual(["booking_idempotency"]);
    expect(b.drift.stale).toEqual([]);
    expect(c.drift.stale).toEqual(["legacy_invoices"]);
    expect(c.drift.pendingMigration).toEqual([]);
    // A tenant with both states reports both, without mixing them up.
    expect(d.drift.pendingMigration).toEqual(["booking_idempotency"]);
    expect(d.drift.stale).toEqual(["legacy_invoices"]);
  });

  it("does not let a healthy tenant hide another tenant's dropped table", () => {
    const withHealthyFirst = classify([healthy, stale]);
    const staleOnly = classify([stale]);
    expect(withHealthyFirst.staleTenants).toEqual(["tenant-c-table-dropped"]);
    expect(withHealthyFirst.perTenant[1].drift).toEqual(staleOnly.perTenant[0].drift);
  });

  it("does not let one tenant's migration lag excuse another tenant's stale table", () => {
    const result = classify([lagging, stale]);
    expect(result.pendingTenants).toEqual(["tenant-b-migrations-pending"]);
    expect(result.staleTenants).toEqual(["tenant-c-table-dropped"]);
    // The lagging tenant is never promoted to stale, and the stale tenant is
    // never downgraded to a tolerated warning.
    expect(result.perTenant[0].verdict).toBe("pending");
    expect(result.perTenant[1].verdict).toBe("stale");
  });

  it("passes when every tenant is up to date", () => {
    const result = classify([healthy, { ...healthy, tenant: "tenant-e" }]);
    expect(result.staleTenants).toEqual([]);
    expect(result.pendingTenants).toEqual([]);
  });

  it("tolerates migration lag across all tenants without failing", () => {
    const result = classify([lagging, { ...lagging, tenant: "tenant-f" }]);
    expect(result.staleTenants).toEqual([]);
    expect(result.pendingTenants).toEqual(["tenant-b-migrations-pending", "tenant-f"]);
    expect(pendingMigrationWarning(result.perTenant[0].drift.pendingMigration)).toContain(
      "booking_idempotency",
    );
  });

  it("names every offending tenant and its own tables in the failure text", () => {
    const message = staleTenantsError(classify([healthy, lagging, stale, both]));
    expect(message).toContain("2 tenant(s)");
    expect(message).toContain("tenant-c-table-dropped: legacy_invoices");
    expect(message).toContain("tenant-d-both: legacy_invoices");
    // Tenants that are fine or merely lagging are not blamed.
    expect(message).not.toContain("tenant-a-up-to-date");
    expect(message).not.toContain("tenant-b-migrations-pending");
    // The tolerated table never appears as a reason to fail.
    expect(message).not.toContain("booking_idempotency");
  });

  it("treats an empty tenant list as nothing to check", () => {
    const result = classify([]);
    expect(result.perTenant).toEqual([]);
    expect(result.staleTenants).toEqual([]);
    expect(result.pendingTenants).toEqual([]);
  });

  it("fails a tenant whose schema view is empty rather than skipping it", () => {
    const result = classify([{ tenant: "tenant-empty", liveTables: [] }]);
    expect(result.perTenant[0].verdict).toBe("stale");
    expect(result.perTenant[0].drift.missing).toEqual(MANIFEST);
    expect(result.staleTenants).toEqual(["tenant-empty"]);
  });

  it("reports the same tenant id twice independently instead of merging it", () => {
    const result = classify([
      { tenant: "tenant-dup", liveTables: healthy.liveTables },
      { tenant: "tenant-dup", liveTables: stale.liveTables },
    ]);
    expect(result.perTenant).toHaveLength(2);
    expect(result.perTenant[0].verdict).toBe("ok");
    expect(result.perTenant[1].verdict).toBe("stale");
  });
});
