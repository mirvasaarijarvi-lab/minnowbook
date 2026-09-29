// Test-only: pretend backends don't know the shared guest-link rate limit.
// Importing this makes any fetch assigned to globalThis answer the
// consume_guest_portal_rate_limit call with "allowed", unless a test sets
// globalThis.__guestPortalRateLimitAllow = false to force a refusal.
const RPC_PATH = "/rest/v1/rpc/consume_guest_portal_rate_limit";

// deno-lint-ignore no-explicit-any
const g = globalThis as any;
if (!g.__guestPortalRateLimitStub) {
  g.__guestPortalRateLimitStub = true;
  let current: typeof fetch = globalThis.fetch;
  const wrap = (inner: typeof fetch): typeof fetch =>
    ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes(RPC_PATH)) {
        const allow = g.__guestPortalRateLimitAllow !== false;
        return Promise.resolve(
          new Response(JSON.stringify(allow), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      return inner(input, init);
    }) as typeof fetch;
  let wrapped = wrap(current);
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    get: () => wrapped,
    set: (fn: typeof fetch) => {
      current = fn;
      wrapped = wrap(current);
    },
  });
}
