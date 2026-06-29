// Verifies that mfa-recovery exposes the request_id on every response so
// clients can correlate user-visible failures with the structured server
// logs. The id MUST appear in:
//   - the `x-request-id` response header (on success, error, and OPTIONS)
//   - `Access-Control-Expose-Headers` so browser fetch() can read it
//   - the JSON body of every error response (`request_id` field)
// and, when the caller supplies an inbound `x-request-id`, the same value
// MUST be echoed back unchanged.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleMfaRecoveryRequest } from "./index.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertExposes(res: Response) {
  const expose = res.headers.get("access-control-expose-headers") ?? "";
  assert(
    expose
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .includes("x-request-id"),
    `Access-Control-Expose-Headers must list x-request-id, got: ${expose}`,
  );
}

Deno.test({
  name: "401 (missing auth) carries request_id in header + body",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const res = await handleMfaRecoveryRequest(
      new Request("http://localhost/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "count" }),
      }),
    );
    assertEquals(res.status, 401);
    const headerId = res.headers.get("x-request-id") ?? "";
    assert(UUID_RE.test(headerId), `expected uuid x-request-id, got: ${headerId}`);
    assertExposes(res);
    const body = await res.json();
    assertEquals(body.request_id, headerId);
    assertEquals(body.code, "NOT_AUTHENTICATED");
    assertEquals(body.error, "Not authenticated");
  },
});

Deno.test({
  name: "401 (malformed bearer) carries request_id in header + body",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const res = await handleMfaRecoveryRequest(
      new Request("http://localhost/", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Token nope" },
        body: JSON.stringify({ action: "count" }),
      }),
    );
    assertEquals(res.status, 401);
    const headerId = res.headers.get("x-request-id") ?? "";
    assert(UUID_RE.test(headerId));
    const body = await res.json();
    assertEquals(body.request_id, headerId);
    assertEquals(body.code, "NOT_AUTHENTICATED");
  },
});

Deno.test({
  name: "inbound x-request-id is echoed on response header and body",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const res = await handleMfaRecoveryRequest(
      new Request("http://localhost/", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": "client-corr-42",
        },
        body: JSON.stringify({ action: "count" }),
      }),
    );
    assertEquals(res.headers.get("x-request-id"), "client-corr-42");
    const body = await res.json();
    assertEquals(body.request_id, "client-corr-42");
  },
});

Deno.test({
  name: "OPTIONS preflight echoes x-request-id and exposes it",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const res = await handleMfaRecoveryRequest(
      new Request("http://localhost/", {
        method: "OPTIONS",
        headers: { "x-request-id": "pre-1" },
      }),
    );
    assertEquals(res.headers.get("x-request-id"), "pre-1");
    assertExposes(res);
  },
});
