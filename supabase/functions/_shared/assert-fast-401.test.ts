// Self-tests for the shared fast-JSON-401 assertion helper.
//
// These don't touch any real handler — they construct synthetic
// handlers that exercise each branch (success path, wrong status,
// over-budget, HTML body, JSON-array body, missing export) and assert
// the helper either passes silently or throws with a message that
// names the regression mode.

import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertFastJson401,
  buildUnauthenticatedProbe,
  DEFAULT_FAST_401_BUDGET_MS,
  loadAuthHandler,
} from "./assert-fast-401.ts";

const okHandler = () =>
  new Response(JSON.stringify({ code: "UNAUTHORIZED" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });

Deno.test("assertFastJson401: happy path returns parsed body + elapsed + response", async () => {
  const req = buildUnauthenticatedProbe("synthetic-ok");
  const result = await assertFastJson401(okHandler, req, { label: "ok" });
  assertEquals(result.body.code, "UNAUTHORIZED");
  assertEquals(result.response.status, 401);
  assert(result.elapsedMs >= 0 && result.elapsedMs < DEFAULT_FAST_401_BUDGET_MS);
  assertEquals(typeof result.rawBody, "string");
});

Deno.test("assertFastJson401: wrong status throws with label + actual code", async () => {
  const handler = () =>
    new Response(JSON.stringify({}), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  const req = buildUnauthenticatedProbe("synthetic-500");
  const err = await assertRejects(
    () => assertFastJson401(handler, req, { label: "wrong-status" }),
    Error,
  );
  assertStringIncludes(err.message, "[wrong-status]");
  assertStringIncludes(err.message, "expected 401");
  assertStringIncludes(err.message, "got 500");
});

Deno.test("assertFastJson401: HTML body fails the JSON guard with diagnostic", async () => {
  const handler = () =>
    new Response("<html><body>Internal Error</body></html>", {
      status: 401,
      headers: { "Content-Type": "text/html" },
    });
  const req = buildUnauthenticatedProbe("synthetic-html");
  const err = await assertRejects(
    () => assertFastJson401(handler, req, { label: "html-body" }),
    Error,
  );
  assertStringIncludes(err.message, "[html-body]");
  assertStringIncludes(err.message, "not JSON");
  assertStringIncludes(err.message, "createClient");
});

Deno.test("assertFastJson401: JSON array body is rejected (must be object)", async () => {
  const handler = () =>
    new Response(JSON.stringify([{ code: "X" }]), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  const req = buildUnauthenticatedProbe("synthetic-array");
  const err = await assertRejects(
    () => assertFastJson401(handler, req, { label: "array-body" }),
    Error,
  );
  assertStringIncludes(err.message, "[array-body]");
  assertStringIncludes(err.message, "must be a JSON object");
});

Deno.test("assertFastJson401: over-budget handler is flagged with timing diagnostic", async () => {
  const handler = async () => {
    await new Promise((r) => setTimeout(r, 80));
    return new Response(JSON.stringify({ code: "UNAUTHORIZED" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  };
  const req = buildUnauthenticatedProbe("synthetic-slow");
  const err = await assertRejects(
    () =>
      assertFastJson401(handler, req, {
        label: "slow-handler",
        budgetMs: 25,
      }),
    Error,
  );
  assertStringIncludes(err.message, "[slow-handler]");
  assertStringIncludes(err.message, "budget 25ms");
  assertStringIncludes(err.message, "before checking auth");
});

Deno.test("assertFastJson401: budgetMs override accepts slower handlers", async () => {
  const handler = async () => {
    await new Promise((r) => setTimeout(r, 40));
    return new Response(JSON.stringify({ code: "UNAUTHORIZED" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  };
  const req = buildUnauthenticatedProbe("synthetic-tolerable");
  const result = await assertFastJson401(handler, req, {
    label: "tolerable",
    budgetMs: 500,
  });
  assert(result.elapsedMs >= 40);
});

Deno.test("buildUnauthenticatedProbe: defaults to POST + {} body + canonical headers", async () => {
  const req = buildUnauthenticatedProbe("xyz");
  assertEquals(req.method, "POST");
  assertEquals(req.headers.get("Content-Type"), "application/json");
  assertEquals(req.headers.get("Origin"), "https://mimmobook.com");
  assert(!req.headers.has("Authorization"), "probe must omit Authorization");
  assertEquals(await req.text(), "{}");
});

Deno.test("buildUnauthenticatedProbe: custom body is JSON-stringified", async () => {
  const req = buildUnauthenticatedProbe("xyz", { body: { path: "a/b.jpg" } });
  assertEquals(await req.text(), JSON.stringify({ path: "a/b.jpg" }));
});

Deno.test("buildUnauthenticatedProbe: GET probes omit the body", async () => {
  const req = buildUnauthenticatedProbe("xyz", { method: "GET" });
  assertEquals(req.method, "GET");
  assertEquals(await req.text(), "");
});

Deno.test("loadAuthHandler: missing export throws with handler name", async () => {
  const err = await assertRejects(
    () => loadAuthHandler("_shared", "doesNotExist"),
    Error,
  );
  assertStringIncludes(err.message, "_shared");
  assertStringIncludes(err.message, "doesNotExist");
});
