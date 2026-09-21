import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Reservation Authorization Audit
 *
 * Calls `public.audit_reservation_authorization()`, which walks every public
 * base table holding customer or reservation data and verifies that no path
 * exists for one account to read another account's data:
 *
 *  - row level security is enabled on the table
 *  - signed-out visitors hold only validated INSERT, never SELECT/UPDATE/
 *    DELETE/TRUNCATE
 *  - the account scoping column (tenant_id) is NOT NULL, except on the
 *    platform-only log tables that admins alone can read
 *  - every SELECT/ALL policy is scoped to membership, role, admin status,
 *    service role or a single-use token
 *  - every signed-out write policy validates the row it accepts
 *  - every SECURITY DEFINER function reachable without signing in that reads
 *    reservation or guest data narrows results by token, account or a
 *    published flag
 *
 * The audit function is SECURITY DEFINER and restricted to trusted callers,
 * so this test is skipped when SUPABASE_SERVICE_ROLE_KEY is absent (CI
 * without secrets, dependency update pull requests).
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasConfig = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

type AuditRow = {
  object_kind: string;
  object_name: string;
  check_name: string;
  status: "pass" | "warn" | "fail";
  severity: string;
  detail: string;
};

const CUSTOMER_DATA_TABLES = [
  "archived_reservations",
  "auth_failure_log",
  "booking_validation_log",
  "email_send_log",
  "email_unsubscribe_tokens",
  "guest_reviews",
  "offers",
  "reservations",
  "suppressed_emails",
  "waitlist",
];

function format(rows: AuditRow[]): string {
  return rows
    .map(
      (r) =>
        `${r.status.toUpperCase()} [${r.severity}] ${r.object_kind} ${r.object_name} / ${r.check_name}: ${r.detail}`,
    )
    .join("\n");
}

describe.runIf(hasConfig)("reservation authorization audit", () => {
  const admin = () =>
    createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  async function runAudit(): Promise<AuditRow[]> {
    const { data, error } = await admin().rpc(
      "audit_reservation_authorization",
    );
    expect(error, error?.message).toBeNull();
    expect(data).toBeTruthy();
    return (data ?? []) as AuditRow[];
  }

  it("reports no failing authorization check", async () => {
    const rows = await runAudit();
    const failures = rows.filter((r) => r.status === "fail");
    expect(failures, `\n${format(failures)}\n`).toHaveLength(0);
  });

  it("covers every known table holding customer data", async () => {
    const rows = await runAudit();
    const audited = new Set(
      rows.filter((r) => r.object_kind === "table").map((r) => r.object_name),
    );
    const missing = CUSTOMER_DATA_TABLES.filter((t) => !audited.has(t));
    expect(missing, `not audited: ${missing.join(", ")}`).toHaveLength(0);
  });

  it("checks row level security and signed-out privileges on reservations", async () => {
    const rows = await runAudit();
    const reservationChecks = rows.filter(
      (r) => r.object_kind === "table" && r.object_name === "reservations",
    );
    const names = reservationChecks.map((r) => r.check_name);
    expect(names).toContain("rls_enabled");
    expect(names).toContain("anon_privileges_minimal");
    expect(names).toContain("tenant_id_not_null");
    expect(reservationChecks.every((r) => r.status === "pass")).toBe(true);
  });

  it("is not callable by a signed-out visitor", async () => {
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
      string | undefined;
    if (!anonKey) return;
    const anon = createClient(SUPABASE_URL!, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await anon.rpc("audit_reservation_authorization");
    expect(error).not.toBeNull();
  });
});
