/**
 * Shared tenant-pair guard helpers used by every cross-tenant security suite
 * (`cross-tenant-rls`, `cross-tenant-storage`, `duplicate-tenant-membership`,
 * and any future suite that needs two distinct tenants).
 *
 * Why this exists
 * ---------------
 *
 * Every cross-tenant test must validate three things BEFORE running any
 * assertion, otherwise the test becomes a silent false negative:
 *
 *   1. **UUID well-formedness** — a non-UUID tenant id (typo, blank, the
 *      literal string "undefined", a slug instead of an id) makes every
 *      `.eq("tenant_id", id)` filter match zero rows. RLS denial then
 *      "passes" trivially, and any cleanup keyed on `tenantId` either
 *      no-ops or sweeps the wrong folder.
 *
 *   2. **Distinctness (dedup)** — if A and B resolve to the same tenant,
 *      every "cross-tenant" attempt is actually same-tenant, so nothing is
 *      proved. This is shockingly easy to get wrong when env vars are
 *      copied between configs.
 *
 *   3. **Membership probe** — even with two distinct UUIDs, each user MUST
 *      already be a member of the tenant we expect. A mismatch (env var
 *      points at a tenant the user isn't in) means storage cleanup would
 *      target the wrong folder AND every "RLS denied my read" assertion
 *      would pass for the wrong reason (no membership instead of denial).
 *
 * Each suite previously open-coded these three checks slightly differently,
 * which is exactly the kind of drift this helper exists to prevent.
 *
 * Design notes
 * ------------
 *
 * - Pure helpers; no Vitest dependency. Throw plain `Error`s with rich,
 *   triage-friendly messages — the suite calls them from `beforeAll` so the
 *   error surfaces as a setup failure (not an assertion failure), which is
 *   the right severity for "your env vars are wrong".
 *
 * - The membership probe uses whatever client the caller hands in (the
 *   user's own authenticated client by default, optionally a service-role
 *   client when the user can't see `tenant_users` directly). Both modes
 *   are correct under current RLS — `tenant_users` is readable by the
 *   member themselves — and the helper does not care which is used.
 *
 * - `assertDistinctTenantPairIds` is intentionally case-insensitive (UUIDs
 *   are case-insensitive per RFC 4122) AND trim-tolerant, so a stray
 *   trailing newline in an env file doesn't slip through as "different".
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantMembershipSnapshot } from "./tenant-guard-record";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns true iff `value` is a syntactically valid v1-v5 UUID. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

/**
 * Normalize a tenant id for comparison: lower-case + trimmed. UUIDs are
 * case-insensitive per RFC 4122; folding here means "ABC...===abc..." for
 * dedup purposes without affecting the value we hand to the SDK (we only
 * use the normalized form for the equality check, never for the query).
 */
function normalize(id: string): string {
  return id.trim().toLowerCase();
}

export interface TenantPairLabels {
  /** Label for the first tenant in error messages. Default "A". */
  a?: string;
  /** Label for the second tenant in error messages. Default "B". */
  b?: string;
  /** Env var prefix used for hint text (e.g. "RLS_TEST_TENANT"). */
  envPrefix?: string;
}

/**
 * Validate a tenant-pair guard: both ids must be present, both must be
 * UUIDs, and the two must be distinct. Throws a single `Error` describing
 * exactly which precondition failed and how to fix it.
 *
 * Use this as the first call in any cross-tenant suite's `beforeAll`.
 */
export function assertDistinctTenantPairIds(
  rawA: string | undefined | null,
  rawB: string | undefined | null,
  labels: TenantPairLabels = {},
): { a: string; b: string } {
  const labelA = labels.a ?? "A";
  const labelB = labels.b ?? "B";
  const envPrefix = labels.envPrefix ?? "RLS_TEST_TENANT";

  const a = (rawA ?? "").trim();
  const b = (rawB ?? "").trim();

  if (!a || !b) {
    throw new Error(
      `Cross-tenant tests require both ${envPrefix}_${labelA}_ID and ${envPrefix}_${labelB}_ID. ` +
        `Got ${labelA}="${a}" ${labelB}="${b}". Set both before running.`,
    );
  }
  if (!isUuid(a) || !isUuid(b)) {
    throw new Error(
      `${envPrefix}_${labelA}_ID / ${envPrefix}_${labelB}_ID must be UUIDs. ` +
        `Got ${labelA}="${a}" ${labelB}="${b}". Likely a typo or a tenant SLUG was used instead of the id.`,
    );
  }
  if (normalize(a) === normalize(b)) {
    throw new Error(
      `${envPrefix}_${labelA}_ID and ${envPrefix}_${labelB}_ID resolve to the same tenant ("${a}"). ` +
        `Cross-tenant tests cannot run against a single tenant — every "denial" would be a false ` +
        `negative and any cleanup would target the wrong folder. Configure two distinct tenants.`,
    );
  }
  return { a, b };
}

export interface MembershipProbeOpts {
  /** Label used in error messages (e.g. "A" or "B"). */
  label: string;
  /** Tenant id the caller is asserting membership in. */
  expectedTenantId: string;
  /** Optional contact (email) to surface in error messages. */
  email?: string;
  /** Env var prefix for the hint text. */
  envPrefix?: string;
}

/**
 * Confirm via the supplied client that the authenticated user is a member
 * of `expectedTenantId`. The client SHOULD be the user's own authenticated
 * client — under current RLS that user can read their own `tenant_users`
 * row — but a service-role client also works (and may be needed if a
 * future RLS change tightens the table further).
 *
 * Throws a triage-friendly error if the probe returns no rows.
 */
export async function assertTenantMembership(
  client: SupabaseClient,
  opts: MembershipProbeOpts,
): Promise<void> {
  const envPrefix = opts.envPrefix ?? "RLS_TEST_TENANT";
  const { data, error } = await client
    .from("tenant_users")
    .select("tenant_id")
    .eq("tenant_id", opts.expectedTenantId)
    .limit(1);

  if (error) {
    throw new Error(
      `Tenant ${opts.label} membership probe failed for tenant ${opts.expectedTenantId}: ${error.message}. ` +
        `If RLS recently changed on tenant_users, switch the probe to a service-role client.`,
    );
  }
  if (!data || data.length === 0) {
    const who = opts.email ? `${opts.label} (${opts.email})` : `Tenant ${opts.label}`;
    throw new Error(
      `${who} is NOT a member of tenant ${opts.expectedTenantId}. ` +
        `Update ${envPrefix}_${opts.label}_ID or add the user to that tenant — otherwise ` +
        `cross-tenant denial assertions would pass for the wrong reason and any cleanup would ` +
        `target the wrong folder.`,
    );
  }
}

/**
 * Fetch the seeded user's effective `tenant_users` row for diagnostics.
 *
 * This is best-effort: a missing row, an RLS-hidden row, or a network
 * error all collapse to a snapshot with `found: false` and (where
 * applicable) a `lookupError` string. We never throw here — the row is
 * purely informational and surfaced in the RLS report so reviewers can
 * see "user X is `staff` in tenant Y, not approved" at a glance when a
 * cross-tenant test fails for an unexpected reason.
 *
 * The query intentionally uses the SAME client as the membership probe
 * so the snapshot reflects what the test session can actually observe.
 * If a future RLS change hides `role` from the member, the snapshot
 * will degrade gracefully to `{ found: true, role: null }`.
 */
export async function fetchTenantMembershipSnapshot(
  client: SupabaseClient,
  tenantId: string,
): Promise<TenantMembershipSnapshot> {
  // Time every debug query so a slow PostgREST round-trip (cold local
  // stack, network blip, missing index) is obvious in CI logs instead of
  // silently inflating suite startup time. Anything >500ms gets a warn
  // prefix; the threshold is intentionally low because this is a
  // single-row PK-ish lookup that should complete in <50ms locally.
  const startedAt = performance.now();
  const finish = (outcome: string) => {
    if (process.env.RLS_GUARD_QUIET === "1") return;
    const elapsed = Math.round(performance.now() - startedAt);
    const prefix = elapsed > 500 ? "[tenant-guard][SLOW]" : "[tenant-guard]";
    // eslint-disable-next-line no-console
    console.log(
      `${prefix} fetchTenantMembershipSnapshot(tenant=${tenantId.slice(0, 8)}…) ${outcome} in ${elapsed}ms`,
    );
  };
  try {
    const { data, error } = await client
      .from("tenant_users")
      .select("user_id, role, custom_role_key, is_approved")
      .eq("tenant_id", tenantId)
      .limit(1)
      .maybeSingle();
    if (error) {
      finish(`error=${error.message}`);
      return { found: false, lookupError: error.message };
    }
    if (!data) {
      finish("no-row");
      return { found: false };
    }
    finish("ok");
    return {
      found: true,
      userId: (data as { user_id?: string | null }).user_id ?? null,
      role: (data as { role?: string | null }).role ?? null,
      customRoleKey: (data as { custom_role_key?: string | null }).custom_role_key ?? null,
      isApproved: (data as { is_approved?: boolean | null }).is_approved ?? null,
    };
  } catch (err) {
    finish(`threw=${err instanceof Error ? err.message : String(err)}`);
    return { found: false, lookupError: err instanceof Error ? err.message : String(err) };
  }
}

export interface TenantPairGuardInput {
  a: { client: SupabaseClient; tenantId: string | undefined | null; email?: string };
  b: { client: SupabaseClient; tenantId: string | undefined | null; email?: string };
  /** Override labels / env-var prefix in error messages. */
  labels?: TenantPairLabels;
  /** Skip the membership probe (rarely useful — only when membership is
   *  intentionally being mutated by the suite, e.g. duplicate-membership). */
  skipMembershipProbe?: boolean;
  /** Suite name written into the guard record so the report can attribute
   *  multiple guard runs (rls vs. storage) within a single CI invocation.
   *  Defaults to "unknown-suite" when omitted. */
  suite?: string;
}

/**
 * One-shot guard combining all three checks for the common "two
 * authenticated clients, two distinct tenants" shape. Returns the
 * normalized (trimmed) tenant ids on success.
 *
 * Side effect: appends a record to `reports/tenant-guard.json` (or the
 * path in `RLS_GUARD_RECORD_PATH`) so the RLS report can surface which
 * tenant ids were validated and whether each membership probe passed.
 * The write is best-effort and never throws.
 *
 * Call this from the suite's `beforeAll` immediately after sign-in:
 *
 * ```ts
 * const { tenantA, tenantB } = await guardTenantPair({
 *   suite: "cross-tenant-rls",
 *   a: { client: clientA, tenantId: liveCreds.a.tenantId, email: liveCreds.a.email },
 *   b: { client: clientB, tenantId: liveCreds.b.tenantId, email: liveCreds.b.email },
 * });
 * ```
 */
export async function guardTenantPair(
  input: TenantPairGuardInput,
): Promise<{ tenantA: string; tenantB: string }> {
  // Lazy import keeps this module dependency-free for any non-test caller
  // that wants `isUuid`/`assertDistinctTenantPairIds` without dragging in
  // the node:fs side-channel.
  const { appendTenantGuardRecord } = await import("./tenant-guard-record");
  const labelA = input.labels?.a ?? "A";
  const labelB = input.labels?.b ?? "B";
  const suite = input.suite ?? "unknown-suite";

  let validA: string | undefined;
  let validB: string | undefined;
  let membershipA: boolean | "skipped" = "skipped";
  let membershipB: boolean | "skipped" = "skipped";

  try {
    const ids = assertDistinctTenantPairIds(
      input.a.tenantId,
      input.b.tenantId,
      input.labels,
    );
    validA = ids.a;
    validB = ids.b;

    if (!input.skipMembershipProbe) {
      await assertTenantMembership(input.a.client, {
        label: labelA,
        expectedTenantId: validA,
        email: input.a.email,
        envPrefix: input.labels?.envPrefix,
      });
      membershipA = true;
      await assertTenantMembership(input.b.client, {
        label: labelB,
        expectedTenantId: validB,
        email: input.b.email,
        envPrefix: input.labels?.envPrefix,
      });
      membershipB = true;
    }

    appendTenantGuardRecord({
      suite,
      recordedAt: new Date().toISOString(),
      tenantA: validA,
      tenantB: validB,
      membershipA,
      membershipB,
      emailA: input.a.email,
      emailB: input.b.email,
    });

    return { tenantA: validA, tenantB: validB };
  } catch (err) {
    // Record the partial state so the report explains WHICH check failed
    // — the test runner will still see the thrown error and fail setup.
    appendTenantGuardRecord({
      suite,
      recordedAt: new Date().toISOString(),
      tenantA: validA,
      tenantB: validB,
      // If we threw before completing a probe, mark it as failed so the
      // report distinguishes "skipped intentionally" from "blew up here".
      membershipA: validA && !input.skipMembershipProbe ? membershipA || false : membershipA,
      membershipB: validB && !input.skipMembershipProbe ? membershipB || false : membershipB,
      emailA: input.a.email,
      emailB: input.b.email,
      failure: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
