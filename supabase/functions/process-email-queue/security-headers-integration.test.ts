// Integration test: every Response returned by `process-email-queue`
// carries the shared SECURITY_HEADERS bag.
//
// Unlike the other handlers in this regression suite, `process-email-queue`
// is invoked by pg_cron and does not implement an OPTIONS preflight branch.
// We therefore exercise the missing-environment 500 branch instead: the
// handler bails out before touching the database while still emitting the
// shared header bag, which makes it the cheapest deterministic path that
// proves the contract.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleProcessEmailQueueRequest } from "./index.ts";
import {
  assertCspAndHsts,
  assertSharedHeaders,
  drainBody,
} from "../_shared/test-security-headers.ts";

Deno.test(
  "process-email-queue: missing-env 500 carries SECURITY_HEADERS",
  async () => {
    // Force the early-return branch by clearing the env vars the
    // handler reads at the top of the request. We snapshot + restore
    // so we do not perturb later tests in the same Deno process.
    const KEYS = [
      "LOVABLE_API_KEY",
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
    ] as const;
    const prev: Record<string, string | undefined> = {};
    for (const k of KEYS) {
      prev[k] = Deno.env.get(k);
      Deno.env.delete(k);
    }
    try {
      const req = new Request("https://example.test/process-email-queue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://mimmobook.com",
        },
        body: "{}",
      });
      const res = await handleProcessEmailQueueRequest(req);
      await drainBody(res);
      assertEquals(res.status, 500);
      assertSharedHeaders(res, "missing-env 500");
      assertCspAndHsts(res, "missing-env 500");
    } finally {
      for (const k of KEYS) {
        if (typeof prev[k] === "string") Deno.env.set(k, prev[k]!);
      }
    }
  },
);
