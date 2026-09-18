import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  classifyManifestDrift,
  pendingMigrationWarning,
  staleManifestError,
  tablesDeclaredInMigrations,
} from "./fixtures/tenant-manifest-drift";

/**
 * Tenant Table Manifest — Migration Lag Guard (offline)
 *
 * Simulates a live database whose migrations lag behind the repository and
 * asserts the manifest guard's classification:
 *
 *   - a manifest table missing live BUT created by a migration → tolerated
 *   - a manifest table missing live AND created by no migration → failure
 *
 * Runs fully offline against temporary migration directories, so it gives
 * the same signal in CI (whose database lags) as it does locally.
 */

let tmpRoot: string;

function writeMigration(name: string, sql: string): void {
  fs.writeFileSync(path.join(tmpRoot, name), sql, "utf8");
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "manifest-lag-"));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe("Tenant Table Manifest — migration SQL lag", () => {
  describe("tablesDeclaredInMigrations", () => {
    it("collects tables across files, nested dirs, quoting and IF NOT EXISTS", () => {
      writeMigration(
        "0001_a.sql",
        `CREATE TABLE public.reservations (id uuid primary key);`,
      );
      writeMigration(
        "0002_b.sql",
        `create table if not exists "public"."booking_idempotency" (\n  id uuid primary key\n);\ncreate table sites (id uuid);`,
      );
      fs.mkdirSync(path.join(tmpRoot, "nested"));
      fs.writeFileSync(
        path.join(tmpRoot, "nested", "0003_c.sql"),
        `CREATE TABLE IF NOT EXISTS "kitchen_orders" (id uuid);`,
        "utf8",
      );
      // Non-SQL files are ignored.
      fs.writeFileSync(
        path.join(tmpRoot, "notes.md"),
        "create table ignored_me (x int);",
        "utf8",
      );

      const declared = tablesDeclaredInMigrations(tmpRoot);

      expect([...declared].sort()).toEqual([
        "booking_idempotency",
        "kitchen_orders",
        "reservations",
        "sites",
      ]);
      expect(declared.has("ignored_me")).toBe(false);
    });

    it("returns an empty set when the migrations directory is absent", () => {
      expect(tablesDeclaredInMigrations(path.join(tmpRoot, "missing"))).toEqual(
        new Set(),
      );
    });

    it("is repeatable across calls (regex state is reset)", () => {
      writeMigration(
        "0001_a.sql",
        `create table alpha (id uuid);\ncreate table beta (id uuid);`,
      );
      const first = tablesDeclaredInMigrations(tmpRoot);
      const second = tablesDeclaredInMigrations(tmpRoot);
      expect([...second].sort()).toEqual([...first].sort());
      expect([...second].sort()).toEqual(["alpha", "beta"]);
    });
  });

  describe("classifyManifestDrift", () => {
    it("tolerates a lagging database: missing table is created by a migration", () => {
      writeMigration(
        "0001_idem.sql",
        `create table public.booking_idempotency (id uuid);`,
      );

      const drift = classifyManifestDrift({
        manifestTables: ["reservations", "sites", "booking_idempotency"],
        // Lagging environment: the newest migration has not been applied.
        liveTables: ["reservations", "sites"],
        declaredInMigrations: tablesDeclaredInMigrations(tmpRoot),
      });

      expect(drift.missing).toEqual(["booking_idempotency"]);
      expect(drift.pendingMigration).toEqual(["booking_idempotency"]);
      expect(drift.stale).toEqual([]);
    });

    it("still fails on a truly dropped table that no migration creates", () => {
      writeMigration(
        "0001_base.sql",
        `create table public.reservations (id uuid);`,
      );

      const drift = classifyManifestDrift({
        manifestTables: ["reservations", "legacy_bookings"],
        liveTables: ["reservations"],
        declaredInMigrations: tablesDeclaredInMigrations(tmpRoot),
      });

      expect(drift.pendingMigration).toEqual([]);
      expect(drift.stale).toEqual(["legacy_bookings"]);
    });

    it("separates pending and stale entries in the same run", () => {
      writeMigration(
        "0001_mixed.sql",
        `create table public.reservations (id uuid);\ncreate table public.booking_idempotency (id uuid);`,
      );

      const drift = classifyManifestDrift({
        manifestTables: [
          "reservations",
          "booking_idempotency",
          "legacy_bookings",
          "old_offers",
        ],
        liveTables: ["reservations"],
        declaredInMigrations: tablesDeclaredInMigrations(tmpRoot),
      });

      expect(drift.pendingMigration).toEqual(["booking_idempotency"]);
      expect(drift.stale).toEqual(["legacy_bookings", "old_offers"]);
    });

    it("reports no drift when the live schema matches the manifest", () => {
      const drift = classifyManifestDrift({
        manifestTables: ["reservations", "sites"],
        liveTables: ["reservations", "sites", "extra_not_in_manifest"],
        declaredInMigrations: ["reservations", "sites"],
      });

      expect(drift).toEqual({ missing: [], pendingMigration: [], stale: [] });
    });

    it("treats a live table as present even when no migration declares it", () => {
      // Tables created outside drizzle migrations must never be flagged.
      const drift = classifyManifestDrift({
        manifestTables: ["waitlist"],
        liveTables: ["waitlist"],
        declaredInMigrations: [],
      });
      expect(drift.missing).toEqual([]);
      expect(drift.stale).toEqual([]);
    });
  });

  describe("operator messages", () => {
    it("warning names the pending tables and the remediation", () => {
      const warning = pendingMigrationWarning([
        "booking_idempotency",
        "kitchen_orders",
      ]);
      expect(warning).toContain("2 manifest table(s)");
      expect(warning).toContain("booking_idempotency, kitchen_orders");
      expect(warning).toContain("Apply the pending migrations");
    });

    it("stale error names the tables and the lists to edit", () => {
      const error = staleManifestError(["legacy_bookings"]);
      expect(error).toContain("1 table(s) that no longer exist");
      expect(error).toContain("legacy_bookings");
      expect(error).toContain("COVERED_TABLES / EXCLUDED_TABLES");
    });
  });

  describe("repository migrations", () => {
    it("declares the tables the live CI database is known to lag on", () => {
      const declared = tablesDeclaredInMigrations();
      expect(declared.size).toBeGreaterThan(0);
      // booking_idempotency is in the manifest and missing from the lagging
      // CI database; the guard may only tolerate it because a migration
      // creates it here. If this migration ever disappears, the guard must
      // go back to failing.
      expect(declared.has("booking_idempotency")).toBe(true);
    });
  });
});
