// Integration test: every error Response from `auth-email-hook`
// carries the universal transport-security triad (HSTS, Referrer-Policy,
// CSP). This function uses a deliberately narrower inline corsHeaders
// bag (auth-webhook contract), so we assert the triad rather than the
// full SECURITY_HEADERS bag.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleAuthEmailHookRequest } from "./index.ts";
import {
  assertCspAndHsts,
  assertSecurityTriad,
  drainBody,
  withStubSupabaseEnv,
} from "../_shared/test-security-headers.ts";

Deno.test("auth-email-hook: OPTIONS preflight carries security triad", async () => {
  const req = new Request("https://example.test/auth-email-hook", {
    method: "OPTIONS",
  });
  const res = await handleAuthEmailHookRequest(req);
  await drainBody(res);
  assertSecurityTriad(res, "OPTIONS preflight (main)");
  assertCspAndHsts(res, "OPTIONS preflight (main)");
});

Deno.test("auth-email-hook: /preview OPTIONS preflight carries security triad", async () => {
  const req = new Request("https://example.test/auth-email-hook/preview", {
    method: "OPTIONS",
  });
  const res = await handleAuthEmailHookRequest(req);
  await drainBody(res);
  assertSecurityTriad(res, "OPTIONS preflight (preview)");
  assertCspAndHsts(res, "OPTIONS preflight (preview)");
});

Deno.test(
  "auth-email-hook: 401 missing-auth carries security triad",
  withStubSupabaseEnv(async () => {
    // No Authorization header: webhook handler returns 401 immediately.
    const req = new Request("https://example.test/auth-email-hook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const res = await handleAuthEmailHookRequest(req);
    await drainBody(res);
    assertEquals(res.status, 401);
    assertSecurityTriad(res, "401 missing auth (main)");
    assertCspAndHsts(res, "401 missing auth (main)");
  }),
);

Deno.test(
  "auth-email-hook: /preview 401 missing-auth carries security triad",
  withStubSupabaseEnv(async () => {
    const req = new Request("https://example.test/auth-email-hook/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const res = await handleAuthEmailHookRequest(req);
    await drainBody(res);
    assertEquals(res.status, 401);
    assertSecurityTriad(res, "401 missing auth (preview)");
    assertCspAndHsts(res, "401 missing auth (preview)");
  }),
);

Deno.test(
  "auth-email-hook: /preview 400 invalid-JSON carries security triad",
  withStubSupabaseEnv(async () => {
    const req = new Request("https://example.test/auth-email-hook/preview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer stub-lovable-key",
      },
      body: "{ not valid json",
    });
    const res = await handleAuthEmailHookRequest(req);
    await drainBody(res);
    assertEquals(res.status, 400);
    assertSecurityTriad(res, "400 invalid JSON (preview)");
    assertCspAndHsts(res, "400 invalid JSON (preview)");
  }),
);
