// Contract test for the standardized error payload shape used by all
// auth-enforced edge functions. If any field name, type, or HTTP behaviour
// drifts, clients depending on `body.code` / `body.message` / `body.status`
// (and the legacy `body.error` alias) will break — so we lock the shape here.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  badRequest,
  errorResponse,
  ErrorCodes,
  forbidden,
  internalError,
  methodNotAllowed,
  notFound,
  requestTooLarge,
  serviceUnavailable,
  tooManyRequests,
  unauthorized,
} from "./errors.ts";

const cors = { "Access-Control-Allow-Origin": "*" };

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const body = await res.json();
  return body as Record<string, unknown>;
}

Deno.test("errorResponse: canonical shape has error+code+message+status and JSON content-type", async () => {
  const res = errorResponse({
    status: 418,
    code: "I_AM_A_TEAPOT",
    message: "short and stout",
    corsHeaders: cors,
    requestId: "req-123",
    details: { hint: "brew tea" },
  });
  assertEquals(res.status, 418);
  assertEquals(res.headers.get("Content-Type"), "application/json; charset=utf-8");
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
  const body = await readJson(res);
  assertEquals(body.error, "I_AM_A_TEAPOT");
  assertEquals(body.code, "I_AM_A_TEAPOT");
  assertEquals(body.message, "short and stout");
  assertEquals(body.status, 418);
  assertEquals(body.requestId, "req-123");
  assertEquals(body.details, { hint: "brew tea" });
});

Deno.test("errorResponse: error and code are always identical (legacy alias preserved)", async () => {
  for (const code of Object.values(ErrorCodes)) {
    const res = errorResponse({ status: 400, code, message: "x", corsHeaders: cors });
    const body = await readJson(res);
    assertEquals(body.error, body.code, `error/code drift for ${code}`);
  }
});

Deno.test("errorResponse: omits requestId and details when not provided", async () => {
  const body = await readJson(errorResponse({
    status: 400,
    code: "X",
    message: "y",
    corsHeaders: cors,
  }));
  assert(!("requestId" in body), "requestId should not be serialized when absent");
  assert(!("details" in body), "details should not be serialized when empty");
});

Deno.test("helpers map to the documented HTTP status + default code", async () => {
  const cases: Array<{ res: Response; status: number; code: string }> = [
    { res: badRequest(cors), status: 400, code: "BAD_REQUEST" },
    { res: unauthorized(cors), status: 401, code: "NOT_AUTHENTICATED" },
    { res: forbidden(cors), status: 403, code: "FORBIDDEN" },
    { res: notFound(cors), status: 404, code: "NOT_FOUND" },
    { res: requestTooLarge(cors), status: 413, code: "REQUEST_TOO_LARGE" },
    { res: tooManyRequests(cors), status: 429, code: "RATE_LIMITED" },
    { res: internalError(cors), status: 500, code: "INTERNAL_ERROR" },
    { res: serviceUnavailable(cors), status: 503, code: "SERVICE_UNAVAILABLE" },
  ];
  for (const { res, status, code } of cases) {
    assertEquals(res.status, status);
    const body = await readJson(res);
    assertEquals(body.code, code);
    assertEquals(body.status, status);
    assert(typeof body.message === "string" && (body.message as string).length > 0);
  }
});

Deno.test("methodNotAllowed sets Allow header listing permitted verbs", async () => {
  const res = methodNotAllowed(cors, ["GET", "POST"]);
  assertEquals(res.status, 405);
  assertEquals(res.headers.get("Allow"), "GET, POST");
  const body = await readJson(res);
  assertEquals(body.code, "METHOD_NOT_ALLOWED");
});

Deno.test("tooManyRequests sets Retry-After when seconds provided", async () => {
  const res = tooManyRequests(cors, 12.4);
  assertEquals(res.status, 429);
  // Ceil — Retry-After is an integer number of seconds per RFC 9110.
  assertEquals(res.headers.get("Retry-After"), "13");
});

Deno.test("tooManyRequests omits Retry-After when not provided or non-positive", () => {
  assertEquals(tooManyRequests(cors).headers.get("Retry-After"), null);
  assertEquals(tooManyRequests(cors, 0).headers.get("Retry-After"), null);
  assertEquals(tooManyRequests(cors, -5).headers.get("Retry-After"), null);
});

Deno.test("overrides win over helper defaults without losing required fields", async () => {
  const res = forbidden(cors, {
    code: "TENANT_SUSPENDED",
    message: "Tenant is suspended",
    requestId: "abc",
  });
  assertEquals(res.status, 403);
  const body = await readJson(res);
  assertEquals(body.code, "TENANT_SUSPENDED");
  assertEquals(body.error, "TENANT_SUSPENDED");
  assertEquals(body.message, "Tenant is suspended");
  assertEquals(body.requestId, "abc");
});
