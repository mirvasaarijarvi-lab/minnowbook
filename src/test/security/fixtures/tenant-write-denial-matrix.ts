/**
 * Write-denial matrix
 * -------------------
 * A user whose tenant pair is denied (no approved membership, failed probe,
 * malformed tenant id, ...) must not be able to change ANY record in another
 * tenant: not by inserting, not by updating, not by deleting, and not through
 * an unfiltered mutation that relies on RLS alone to scope the rows.
 *
 * The matrix below enumerates those mutation shapes. It is pure data so the
 * checks run offline; the live suites feed real Supabase responses through the
 * very same `rls-assert` helpers.
 */
import { ACTING_TENANT, TARGET_TENANT } from "./tenant-access-matrix";

export type MutationKind = "insert" | "update" | "delete" | "upsert" | "rpc";

export interface WriteDenialCase {
  /** Unique label; also the test name. */
  label: string;
  kind: MutationKind;
  /** SQL operation reported for this path. */
  operation: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  attemptedQuery: string;
  /** True when the statement carries no tenant filter of its own. */
  unfiltered: boolean;
  /** Rows a leaking database would return from `.select()` after the write. */
  leakedRows: Array<Record<string, unknown>>;
  scenario?: string;
}

const leaked = (extra: Record<string, unknown> = {}) => ({
  id: "99999999-9999-4999-8999-999999999999",
  tenant_id: TARGET_TENANT,
  ...extra,
});

export const WRITE_DENIAL_MATRIX: WriteDenialCase[] = [
  {
    label: "insert: row explicitly stamped with the other tenant's id",
    kind: "insert",
    operation: "INSERT",
    table: "reservations",
    attemptedQuery: "from('reservations').insert({ tenant_id: TARGET, ... }).select()",
    unfiltered: false,
    leakedRows: [leaked({ guest_name: "Foreign Guest" })],
    scenario: "denied user inserts into another tenant",
  },
  {
    label: "insert: row with no tenant_id at all (server must not guess)",
    kind: "insert",
    operation: "INSERT",
    table: "reservations",
    attemptedQuery: "from('reservations').insert({ guest_name: '...' }).select()",
    unfiltered: true,
    leakedRows: [leaked()],
  },
  {
    label: "insert: bulk insert mixing own and foreign tenant rows",
    kind: "insert",
    operation: "INSERT",
    table: "reservations",
    attemptedQuery:
      "from('reservations').insert([{ tenant_id: OWN }, { tenant_id: TARGET }]).select()",
    unfiltered: false,
    leakedRows: [leaked()],
  },
  {
    label: "insert: child row pointing at the other tenant's resource",
    kind: "insert",
    operation: "INSERT",
    table: "resource_images",
    attemptedQuery:
      "from('resource_images').insert({ resource_id: FOREIGN_ID, tenant_id: TARGET }).select()",
    unfiltered: false,
    leakedRows: [leaked({ image_url: "https://example.test/foreign.jpg" })],
  },
  {
    label: "update: foreign row selected by id",
    kind: "update",
    operation: "UPDATE",
    table: "reservations",
    attemptedQuery:
      "from('reservations').update({ is_invoiced: true }).eq('id', FOREIGN_ID).select()",
    unfiltered: false,
    leakedRows: [leaked({ is_invoiced: true })],
  },
  {
    label: "update: unfiltered update of an entire table",
    kind: "update",
    operation: "UPDATE",
    table: "reservations",
    attemptedQuery: "from('reservations').update({ status: 'cancelled' }).neq('id', ZERO).select()",
    unfiltered: true,
    leakedRows: [leaked({ status: "cancelled" }), leaked({ status: "cancelled" })],
    scenario: "denied user runs an unfiltered UPDATE",
  },
  {
    label: "update: tenant_id rewritten to steal a row (tenant hopping)",
    kind: "update",
    operation: "UPDATE",
    table: "reservations",
    attemptedQuery:
      "from('reservations').update({ tenant_id: OWN }).eq('id', FOREIGN_ID).select()",
    unfiltered: false,
    leakedRows: [leaked({ tenant_id: ACTING_TENANT })],
  },
  {
    label: "update: privilege escalation on the other tenant's memberships",
    kind: "update",
    operation: "UPDATE",
    table: "tenant_users",
    attemptedQuery:
      "from('tenant_users').update({ role: 'owner' }).eq('tenant_id', TARGET).select()",
    unfiltered: false,
    leakedRows: [leaked({ role: "owner" })],
  },
  {
    label: "update: settings of the other tenant",
    kind: "update",
    operation: "UPDATE",
    table: "tenant_settings",
    attemptedQuery:
      "from('tenant_settings').update({ business_email: 'x@example.test' }).eq('tenant_id', TARGET).select()",
    unfiltered: false,
    leakedRows: [leaked()],
  },
  {
    label: "upsert: insert-or-update on a foreign primary key",
    kind: "upsert",
    operation: "INSERT",
    table: "resources",
    attemptedQuery: "from('resources').upsert({ id: FOREIGN_ID, tenant_id: TARGET }).select()",
    unfiltered: false,
    leakedRows: [leaked({ name: "Foreign Sauna" })],
  },
  {
    label: "upsert: bulk upsert with no tenant filter",
    kind: "upsert",
    operation: "INSERT",
    table: "resources",
    attemptedQuery: "from('resources').upsert([{ id: FOREIGN_ID }, { id: OWN_ID }]).select()",
    unfiltered: true,
    leakedRows: [leaked()],
  },
  {
    label: "delete: foreign row selected by id",
    kind: "delete",
    operation: "DELETE",
    table: "reservations",
    attemptedQuery: "from('reservations').delete().eq('id', FOREIGN_ID).select()",
    unfiltered: false,
    leakedRows: [leaked()],
  },
  {
    label: "delete: unfiltered delete of an entire table",
    kind: "delete",
    operation: "DELETE",
    table: "reservations",
    attemptedQuery: "from('reservations').delete().neq('id', ZERO).select()",
    unfiltered: true,
    leakedRows: [leaked(), leaked()],
    scenario: "denied user runs an unfiltered DELETE",
  },
  {
    label: "delete: foreign tenant's booking tokens (no tenant filter)",
    kind: "delete",
    operation: "DELETE",
    table: "booking_tokens",
    attemptedQuery: "from('booking_tokens').delete().eq('token', FOREIGN_TOKEN).select()",
    unfiltered: true,
    leakedRows: [leaked({ token: "tok_foreign" })],
  },
  {
    label: "delete: append-only audit log of the other tenant",
    kind: "delete",
    operation: "DELETE",
    table: "audit_log",
    attemptedQuery: "from('audit_log').delete().eq('tenant_id', TARGET).select()",
    unfiltered: false,
    leakedRows: [leaked()],
  },
  {
    label: "rpc: write-capable function called for the other tenant",
    kind: "rpc",
    operation: "UPDATE",
    table: "claim_discount_code",
    attemptedQuery: "rpc('claim_discount_code', { tenant_id: TARGET, code: 'X' })",
    unfiltered: false,
    leakedRows: [leaked({ used_count: 1 })],
  },
  {
    label: "rpc: write-capable function called with no tenant argument",
    kind: "rpc",
    operation: "UPDATE",
    table: "claim_access_code",
    attemptedQuery: "rpc('claim_access_code', { code: 'X' })",
    unfiltered: true,
    leakedRows: [leaked()],
  },
];

/** Values that must never surface for a denied mutation. */
export const FOREIGN_WRITE_METADATA = [
  TARGET_TENANT,
  "99999999-9999-4999-8999-999999999999",
  "Foreign Guest",
  "Foreign Sauna",
  "tok_foreign",
  "https://example.test/foreign.jpg",
];
