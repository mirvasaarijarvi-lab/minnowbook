// Regression tests: staff management re-checks the caller's role and account
// on every request. The same sign-in must stop working as soon as the account
// is demoted, removed from the business or disabled, and start working when
// promoted. The backend is a stubbed fetch whose stored state each test edits
// between requests, so nothing is cached from an earlier call.
import { handleAdminUsersRequest } from "./index.ts";

const USER_ID = "33333333-3333-4333-8333-333333333333";
const TENANT_ID = "44444444-4444-4444-8444-444444444444";

type State = {
  role: string | null; // null = no longer a member of any business
  accountActive: boolean; // false = auth server rejects the session
  sysAdmin: boolean;
};

function b64url(obj: unknown): string {
  return btoa(JSON.stringify(obj)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
const TOKEN = [
  b64url({ alg: "HS256", typ: "JWT" }),
  b64url({
    sub: USER_ID,
    role: "authenticated",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  }),
  "c2lnbmF0dXJl",
].join(".");

let ip = 0;

async function withBackend(state: State, run: (send: () => Promise<Response>) => Promise<void>) {
  const realFetch = globalThis.fetch;
  const saved = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"].map(
    (k) => [k, Deno.env.get(k)] as const,
  );
  Deno.env.set("SUPABASE_URL", "https://stub.supabase.test");
  Deno.env.set("SUPABASE_ANON_KEY", "stub-anon-key");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub-service-role-key");

  globalThis.fetch = ((input: Request | URL | string, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const url = new URL(req.url);
    const json = (status: number, body: unknown) =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        }),
      );
    if (url.pathname.includes("/.well-known/jwks.json")) return json(200, { keys: [] });
    if (url.pathname.endsWith("/auth/v1/user")) {
      return state.accountActive
        ? json(200, { id: USER_ID, aud: "authenticated", role: "authenticated" })
        : json(403, { code: 403, error_code: "user_banned", msg: "User is banned" });
    }
    const table = url.pathname.split("/").pop();
    const single = (req.headers.get("accept") ?? "").includes("vnd.pgrst.object");
    if (table === "tenant_users" && req.method === "GET") {
      const filtersCaller = url.searchParams.get("user_id") === `eq.${USER_ID}`;
      if (filtersCaller && single) {
        return state.role
          ? json(200, { role: state.role, tenant_id: TENANT_ID, custom_role_key: null })
          : json(406, { code: "PGRST116", message: "no rows" });
      }
      return json(200, []);
    }
    if (table === "system_admins") {
      return state.sysAdmin ? json(200, { id: "sa" }) : json(406, { code: "PGRST116", message: "no rows" });
    }
    if (req.method === "GET") return json(200, single ? {} : []);
    return json(200, {});
  }) as typeof fetch;

  const send = () =>
    handleAdminUsersRequest(
      new Request("https://example.test/admin-users", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${TOKEN}`,
          Origin: "https://mimmobook.com",
          "x-forwarded-for": `10.1.0.${++ip}`,
        },
        body: JSON.stringify({ action: "list" }),
      }),
    );

  try {
    await run(send);
  } finally {
    globalThis.fetch = realFetch;
    for (const [k, v] of saved) v === undefined ? Deno.env.delete(k) : Deno.env.set(k, v);
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
async function expectAllowed(res: Response, label: string) {
  const body = await res.text();
  assert(res.status === 200, `${label}: expected 200, got ${res.status} ${body}`);
}
async function expectRefused(res: Response, label: string) {
  const body = await res.text();
  assert(res.status >= 400 && res.status < 500, `${label}: expected refusal, got ${res.status} ${body}`);
  assert(!/"users"\s*:/.test(body), `${label}: refused request still returned the staff list`);
}

Deno.test("control: an owner can list staff", async () => {
  await withBackend({ role: "owner", accountActive: true, sysAdmin: false }, async (send) => {
    await expectAllowed(await send(), "owner");
  });
});

for (const from of ["owner", "admin"]) {
  Deno.test(`${from} demoted to staff: the same sign-in is refused on the next request`, async () => {
    const state: State = { role: from, accountActive: true, sysAdmin: false };
    await withBackend(state, async (send) => {
      await expectAllowed(await send(), `${from} before demotion`);
      state.role = "staff";
      await expectRefused(await send(), `${from} after demotion`);
    });
  });
}

Deno.test("admin removed from the business: the same sign-in is refused", async () => {
  const state: State = { role: "admin", accountActive: true, sysAdmin: false };
  await withBackend(state, async (send) => {
    await expectAllowed(await send(), "admin before removal");
    state.role = null;
    await expectRefused(await send(), "admin after removal");
  });
});

Deno.test("owner account disabled: the same sign-in is refused as not signed in", async () => {
  const state: State = { role: "owner", accountActive: true, sysAdmin: false };
  await withBackend(state, async (send) => {
    await expectAllowed(await send(), "owner before disabling");
    state.accountActive = false;
    const res = await send();
    const body = await res.text();
    assert(res.status === 401, `disabled account: expected 401, got ${res.status} ${body}`);
  });
});

Deno.test("staff promoted to admin: access starts on the next request", async () => {
  const state: State = { role: "staff", accountActive: true, sysAdmin: false };
  await withBackend(state, async (send) => {
    await expectRefused(await send(), "staff before promotion");
    state.role = "admin";
    await expectAllowed(await send(), "after promotion to admin");
  });
});

Deno.test("platform admin rights withdrawn: a non-member is refused", async () => {
  const state: State = { role: null, accountActive: true, sysAdmin: true };
  await withBackend(state, async (send) => {
    state.sysAdmin = false;
    await expectRefused(await send(), "former platform admin");
  });
});
