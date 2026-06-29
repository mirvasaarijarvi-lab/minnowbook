// Shared auth/authorization helper for edge functions.
//
// Why this exists:
//   Every auth-enforced function previously duplicated the same five-step
//   recipe (parse Authorization header → create user client → call
//   getClaims → handle error → extract sub). Subtle differences across
//   functions (different status codes, missing timeouts on getClaims, mixed
//   error shapes) caused hard-to-diagnose hangs and 504s under load when
//   getClaims occasionally stalled on a cold network path.
//
//   This helper centralises the recipe AND wraps getClaims in a hard
//   timeout so a slow/stuck call surfaces as a fast 401 instead of a
//   gateway-level hang.
//
// Usage:
//   const auth = await requireAuth(req, corsHeaders);
//   if (auth instanceof Response) return auth;
//   const { userId, claims, adminClient, userClient } = auth;

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_GETCLAIMS_TIMEOUT_MS = 5_000;

export type RequireAuthOptions = {
  /** Override the timeout for the getClaims() round-trip. Defaults to 5s. */
  timeoutMs?: number;
  /** Error code returned in the JSON body. Defaults to "NOT_AUTHENTICATED". */
  errorCode?: string;
  /** Error message returned in the JSON body. Defaults to "Not authenticated". */
  errorMessage?: string;
};

export type AuthContext = {
  userId: string;
  email: string | null;
  token: string;
  claims: Record<string, unknown>;
  authHeader: string;
  userClient: SupabaseClient;
  adminClient: SupabaseClient;
};

function unauthorized(
  corsHeaders: Record<string, string>,
  opts: RequireAuthOptions,
): Response {
  return new Response(
    JSON.stringify({
      error: opts.errorCode ?? "NOT_AUTHENTICATED",
      message: opts.errorMessage ?? "Not authenticated",
    }),
    {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

/**
 * Resolve, validate, and return the calling user's identity, or a 401 Response.
 *
 * The returned `adminClient` uses the service-role key — only use it for
 * server-trusted reads/writes after you have verified the caller's identity
 * and authorization.
 */
export async function requireAuth(
  req: Request,
  corsHeaders: Record<string, string>,
  options: RequireAuthOptions = {},
): Promise<AuthContext | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return unauthorized(corsHeaders, options);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    // Misconfiguration — treat as auth failure rather than leaking 500s.
    console.error("[requireAuth] missing SUPABASE_URL / keys in environment");
    return unauthorized(corsHeaders, options);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return unauthorized(corsHeaders, options);

  const timeoutMs = options.timeoutMs ?? DEFAULT_GETCLAIMS_TIMEOUT_MS;

  let timer: number | undefined;
  const timeout = new Promise<"__timeout__">((resolve) => {
    timer = setTimeout(() => resolve("__timeout__"), timeoutMs) as unknown as number;
  });

  let claimsResult: Awaited<ReturnType<typeof userClient.auth.getClaims>> | "__timeout__";
  try {
    claimsResult = await Promise.race([userClient.auth.getClaims(token), timeout]);
  } catch (err) {
    console.error("[requireAuth] getClaims threw", err);
    return unauthorized(corsHeaders, options);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }

  if (claimsResult === "__timeout__") {
    console.error(`[requireAuth] getClaims timed out after ${timeoutMs}ms`);
    return unauthorized(corsHeaders, options);
  }

  const { data: claimsData, error: claimsError } = claimsResult;
  if (claimsError || !claimsData?.claims) {
    return unauthorized(corsHeaders, options);
  }

  const claims = claimsData.claims as Record<string, unknown>;
  const userId = typeof claims.sub === "string" ? claims.sub : "";
  if (!userId) return unauthorized(corsHeaders, options);

  const email = typeof claims.email === "string" ? claims.email : null;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  return {
    userId,
    email,
    token,
    claims,
    authHeader,
    userClient,
    adminClient,
  };
}
