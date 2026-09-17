/**
 * Manifest drift classification for the tenant-table coverage guard.
 *
 * Extracted from `tenant-table-manifest.test.ts` so the decision logic —
 * "is this manifest entry awaiting a migration, or genuinely stale?" — can
 * be unit-tested offline without a live database.
 *
 * Background
 * ----------
 * The guard compares the manifest (COVERED_TABLES + EXCLUDED_TABLES)
 * against the live schema. A live database whose migrations lag behind the
 * repository (a separate CI project, a freshly reset local stack) reports
 * a table as missing even though a migration in `drizzle/migrations`
 * creates it. That is migration lag, not a stale manifest, and must not
 * fail the guard. A table that no migration creates anywhere IS stale (it
 * was dropped or renamed) and must fail.
 */
import fs from "node:fs";
import path from "node:path";

/** Matches `create table [if not exists] [public.]<name>` in migration SQL. */
const CREATE_TABLE_RE =
  /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\.)?"?([a-z0-9_]+)"?/gi;

/**
 * Every public-schema table created by a migration under `root`
 * (default: `drizzle/migrations`). Returns an empty set when the directory
 * does not exist, which makes every missing entry classify as stale.
 */
export function tablesDeclaredInMigrations(
  root: string = path.resolve(process.cwd(), "drizzle/migrations"),
): Set<string> {
  const declared = new Set<string>();
  if (!fs.existsSync(root)) return declared;

  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".sql")) {
        const sql = fs.readFileSync(full, "utf8");
        CREATE_TABLE_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = CREATE_TABLE_RE.exec(sql)) !== null) {
          declared.add(m[1].toLowerCase());
        }
      }
    }
  };

  walk(root);
  return declared;
}

export interface ManifestDrift {
  /** Manifest entries absent from the live schema, in manifest order. */
  missing: string[];
  /** Absent, but created by a migration in the repo — tolerated (warn). */
  pendingMigration: string[];
  /** Absent and created by no migration — dropped or renamed (fail). */
  stale: string[];
}

/**
 * Split manifest entries that the live schema does not have into
 * "pending migration" (tolerated) and "stale" (must fail).
 */
export function classifyManifestDrift(input: {
  /** COVERED_TABLES + EXCLUDED_TABLES keys. */
  manifestTables: Iterable<string>;
  /** Table names the live database reports as tenant-scoped. */
  liveTables: Iterable<string>;
  /** Tables created by migrations in the repository. */
  declaredInMigrations: Iterable<string>;
}): ManifestDrift {
  const liveSet = new Set(input.liveTables);
  const declaredSet = new Set(input.declaredInMigrations);
  const missing = [...input.manifestTables].filter((t) => !liveSet.has(t));
  return {
    missing,
    pendingMigration: missing.filter((t) => declaredSet.has(t)),
    stale: missing.filter((t) => !declaredSet.has(t)),
  };
}

/** Warning text for entries awaiting a migration in this environment. */
export function pendingMigrationWarning(pendingMigration: string[]): string {
  return (
    `[tenant-table-manifest] ${pendingMigration.length} manifest table(s) are not in the ` +
    `live schema yet but are created by a migration in drizzle/migrations: ` +
    `${pendingMigration.join(", ")}. Apply the pending migrations to this environment.`
  );
}

/** Failure text for entries that no migration creates. */
export function staleManifestError(stale: string[]): string {
  return (
    `Manifest lists ${stale.length} table(s) that no longer exist in the public schema: ` +
    `${stale.join(", ")}. Remove them from COVERED_TABLES / EXCLUDED_TABLES.`
  );
}

/** One tenant environment's view of the live schema. */
export interface TenantSchemaView {
  /** Stable tenant identifier (uuid in live runs, label in offline tests). */
  tenant: string;
  /** Tables the live database reports as tenant-scoped for this tenant. */
  liveTables: Iterable<string>;
}

export type TenantDriftVerdict = "ok" | "pending" | "stale";

export interface TenantDriftResult {
  tenant: string;
  drift: ManifestDrift;
  verdict: TenantDriftVerdict;
}

export interface MultiTenantDrift {
  /** One result per input tenant, in input order. Never merged. */
  perTenant: TenantDriftResult[];
  /** Tenants whose manifest entries only await a pending migration. */
  pendingTenants: string[];
  /** Tenants with at least one genuinely dropped table — these must fail. */
  staleTenants: string[];
}

/**
 * Classify manifest drift for several tenant environments at once, keeping
 * each tenant's result strictly separate.
 *
 * Isolation rule: a table is judged only against the tenant whose schema
 * view reported it. One tenant lagging on migrations can never make another
 * tenant's dropped table look tolerable, and one tenant being healthy can
 * never hide a second tenant's drift.
 */
export function classifyManifestDriftForTenants(input: {
  manifestTables: Iterable<string>;
  tenants: TenantSchemaView[];
  declaredInMigrations: Iterable<string>;
}): MultiTenantDrift {
  const manifestTables = [...input.manifestTables];
  const declaredInMigrations = [...input.declaredInMigrations];
  const perTenant = input.tenants.map((view) => {
    const drift = classifyManifestDrift({
      manifestTables,
      liveTables: view.liveTables,
      declaredInMigrations,
    });
    const verdict: TenantDriftVerdict =
      drift.stale.length > 0 ? "stale" : drift.pendingMigration.length > 0 ? "pending" : "ok";
    return { tenant: view.tenant, drift, verdict };
  });
  return {
    perTenant,
    pendingTenants: perTenant.filter((r) => r.verdict === "pending").map((r) => r.tenant),
    staleTenants: perTenant.filter((r) => r.verdict === "stale").map((r) => r.tenant),
  };
}

/** Failure text naming each tenant with its own dropped tables. */
export function staleTenantsError(result: MultiTenantDrift): string {
  const parts = result.perTenant
    .filter((r) => r.verdict === "stale")
    .map((r) => `${r.tenant}: ${r.drift.stale.join(", ")}`);
  return (
    `Manifest lists table(s) that no longer exist for ${parts.length} tenant(s) ` +
    `(${parts.join(" | ")}). Remove them from COVERED_TABLES / EXCLUDED_TABLES.`
  );
}
