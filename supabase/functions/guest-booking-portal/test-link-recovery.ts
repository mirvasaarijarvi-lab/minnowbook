// Recovery for throwaway guest links left behind when an integration test
// process stops before its `finally` cleanup runs (killed job, timeout, crash).
//
// Safety: a link is only ever removed when ALL of these hold:
//   1. its code starts with TEST_LINK_PREFIX, which only these tests use
//      (real link codes never contain it), checked in the query AND again here;
//   2. it belongs to the allowed test business (refuses any other business);
//   3. it was created more than STALE_AFTER_MS ago, so a run still in progress
//      elsewhere is never touched.
// Deletes by id with the same three filters repeated, then reads back to
// confirm. Never prints link codes, only counts.

export const TEST_LINK_PREFIX = "ci-guestlinktest-";
export const DEFAULT_TEST_TENANT_ID = "9ac05fbf-0834-44fd-a52a-d030b7074a30"; // "mimmin-testi"
export const STALE_AFTER_MS = 15 * 60_000;

/** A throwaway link code with the test marker (accepted by the portal: [A-Za-z0-9_-]{16,128}). */
export function newTestToken(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return TEST_LINK_PREFIX + hex;
}

export function isTestToken(token: unknown): token is string {
  return typeof token === "string" && token.startsWith(TEST_LINK_PREFIX) &&
    /^[a-f0-9]{64}$/.test(token.slice(TEST_LINK_PREFIX.length));
}

type Res<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;
type Row = { id: string; token: string; tenant_id: string; created_at: string };
// Minimal client shape (keeps this unit-testable with a pretend store).
export type RecoveryClient = {
  from(table: "booking_tokens"): {
    select(cols: "id, token, tenant_id, created_at"): {
      eq(c: "tenant_id", v: string): { like(c: "token", v: string): { lt(c: "created_at", v: string): Res<Row[]> } };
    };
    delete(): {
      in(c: "id", v: string[]): { eq(c: "tenant_id", v: string): { like(c: "token", v: string): Res<unknown> } };
    };
  };
};

export type RecoveryResult = { found: number; deleted: number; skipped: number };

export async function recoverStaleTestLinks(
  client: RecoveryClient,
  opts: {
    tenantId: string;
    allowedTenantId?: string;
    now?: number;
    staleAfterMs?: number;
    log?: (m: string) => void;
  },
): Promise<RecoveryResult> {
  const log = opts.log ?? ((m) => console.log(m));
  const allowed = opts.allowedTenantId ??
    (typeof Deno !== "undefined" ? Deno.env.get("GUEST_PORTAL_TEST_TENANT_ID") : undefined) ??
    DEFAULT_TEST_TENANT_ID;
  if (!opts.tenantId || opts.tenantId !== allowed) {
    throw new Error("recovery refused: not the test business");
  }
  const staleAfter = opts.staleAfterMs ?? STALE_AFTER_MS;
  if (!(staleAfter >= 60_000)) throw new Error("recovery refused: stale age must be at least 1 minute");
  const cutoff = new Date((opts.now ?? Date.now()) - staleAfter).toISOString();
  const pattern = `${TEST_LINK_PREFIX}%`;

  const found = await client.from("booking_tokens")
    .select("id, token, tenant_id, created_at")
    .eq("tenant_id", opts.tenantId).like("token", pattern).lt("created_at", cutoff);
  if (found.error) throw new Error(`recovery: lookup failed (${found.error.message.slice(0, 80)})`);
  const rows = found.data ?? [];
  // Second, independent check of every row before deleting anything.
  const safe = rows.filter((r) =>
    isTestToken(r.token) && r.tenant_id === opts.tenantId &&
    Date.parse(r.created_at) < Date.parse(cutoff)
  );
  const skipped = rows.length - safe.length;
  if (safe.length === 0) {
    log(`recovery: no leftover test links${skipped ? ` (${skipped} ignored)` : ""}`);
    return { found: rows.length, deleted: 0, skipped };
  }
  const ids = safe.map((r) => r.id);
  const del = await client.from("booking_tokens").delete()
    .in("id", ids).eq("tenant_id", opts.tenantId).like("token", pattern);
  if (del.error) throw new Error(`recovery: delete failed (${del.error.message.slice(0, 80)})`);
  const again = await client.from("booking_tokens")
    .select("id, token, tenant_id, created_at")
    .eq("tenant_id", opts.tenantId).like("token", pattern).lt("created_at", cutoff);
  if (again.error) throw new Error(`recovery: read-back failed (${again.error.message.slice(0, 80)})`);
  const left = (again.data ?? []).filter((r) => ids.includes(r.id)).length;
  if (left > 0) throw new Error(`recovery failed: ${left} of ${ids.length} leftover test links still stored`);
  log(`recovery: removed ${ids.length} leftover test link(s)${skipped ? `, ${skipped} ignored` : ""}`);
  return { found: rows.length, deleted: ids.length, skipped };
}
