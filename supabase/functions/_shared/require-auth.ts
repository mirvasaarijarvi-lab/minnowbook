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
import { errorResponse, ErrorCodes } from "./errors.ts";

const DEFAULT_GETCLAIMS_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// Structured logging (PII/token-safe)
// ---------------------------------------------------------------------------
//
// All logs go through `logEvent` so they share one JSON shape that's easy to
// grep in the edge-runtime log stream. We NEVER log:
//   - the raw Authorization header
//   - the raw access token
//   - the user's email address
//   - any claim value verbatim
//
// Instead we emit:
//   - a short, non-reversible token fingerprint (FNV-1a, 8 hex chars) so the
//     same token in two log lines is correlatable across requests within a
//     short window without being recoverable
//   - structural shape (token length, "Bearer " prefix present, JWT segment
//     count) so we can tell a malformed token from a valid-shape token that
//     the auth server still rejected
//   - durations in ms for each network step

type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

function logEvent(level: LogLevel, event: string, fields: LogFields = {}): void {
  // Single-line JSON keeps log aggregation parsers happy.
  const payload = {
    ts: new Date().toISOString(),
    scope: "require-auth",
    level,
    event,
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

/**
 * Deterministic short fingerprint for a token-like string. Uses FNV-1a 32-bit
 * over the UTF-8 bytes. The output is 8 hex chars — collision-prone by
 * design so it can't be used to identify a specific user, but stable enough
 * to correlate "the same request showed up twice" within a log window.
 *
 * Never use this for anything security-sensitive (auth, signing, etc.).
 */
function tokenFingerprint(token: string): string {
  if (!token) return "00000000";
  const bytes = new TextEncoder().encode(token);
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    // 32-bit FNV prime multiplication (kept inside Math.imul for safety).
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function tokenShape(token: string) {
  const segments = token.split(".");
  return {
    len: token.length,
    segments: segments.length,
    // A well-formed JWT has 3 non-empty segments; anything else is a strong
    // signal the caller sent something other than a Supabase access token.
    looksLikeJwt: segments.length === 3 && segments.every((s) => s.length > 0),
  };
}

/**
 * Decode the unverified payload of a JWT. We do NOT trust the result for any
 * security decision — we only use it to recognise tokens that are structurally
 * incapable of authenticating a user (anon / service_role / non-Supabase) so
 * we can short-circuit BEFORE hitting GoTrue.
 *
 * Reading the payload locally is ~microseconds. Round-tripping the same token
 * to GoTrue is ~300-700ms and serialises behind a small outbound connection
 * pool, which is exactly the bottleneck that made the redeem-burst tests time
 * out (the Functions gateway auto-promotes the `apikey` header to
 * `Authorization: Bearer <anon_key>`, so every "unauthenticated" call was
 * spending half a second proving the obvious).
 */
function decodeJwtPayloadUnsafe(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    // base64url -> base64
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = atob(padded);
    const obj = JSON.parse(json);
    return obj && typeof obj === "object" ? (obj as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Returns a reason string if the token is provably not a user access token
 * (anon key, service-role key, or non-Supabase issuer), otherwise null.
 * Used to fast-fail before calling getClaims().
 */
function nonUserTokenReason(token: string): string | null {
  const payload = decodeJwtPayloadUnsafe(token);
  if (!payload) return null; // unknown shape — let getClaims decide
  const role = typeof payload.role === "string" ? payload.role : "";
  if (role === "anon") return "anon_key_presented_as_user_token";
  if (role === "service_role") return "service_role_key_presented_as_user_token";
  // Supabase user access tokens always carry role="authenticated" and an iss
  // ending in "/auth/v1". If neither is true and a non-user role is set, the
  // token cannot resolve to a user.
  if (role && role !== "authenticated") return `non_user_role_${role}`;
  return null;
}


let requestSeq = 0;
function newRequestId(): string {
  requestSeq = (requestSeq + 1) % 0xffffffff;
  // 6 hex chars of monotonic counter + 4 random hex — short enough to read,
  // unique enough within a single function instance's lifetime.
  const rand = Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
  return `${requestSeq.toString(16).padStart(6, "0")}${rand}`;
}

export type RequireAuthOptions = {
  /** Override the timeout for the getClaims() round-trip. Defaults to 5s. */
  timeoutMs?: number;
  /** Error code returned in the JSON body. Defaults to "NOT_AUTHENTICATED". */
  errorCode?: string;
  /** Error message returned in the JSON body. Defaults to "Not authenticated". */
  errorMessage?: string;
  /**
   * Caller label used in structured logs (e.g. "admin-users"). Helps when
   * triaging a timeout to a specific function without grepping stack traces.
   */
  caller?: string;
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
  requestId?: string,
): Response {
  return errorResponse({
    status: 401,
    code: opts.errorCode ?? ErrorCodes.NOT_AUTHENTICATED,
    message: opts.errorMessage ?? "Not authenticated",
    corsHeaders,
    requestId,
  });
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
  const reqId = newRequestId();
  const caller = options.caller ?? "unknown";
  const startedAt = performance.now();

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    logEvent("warn", "reject", {
      reqId,
      caller,
      reason: "missing_or_malformed_header",
      hasHeader: authHeader !== null,
      // length only — never the header value itself
      headerLen: authHeader?.length ?? 0,
      elapsedMs: Math.round(performance.now() - startedAt),
    });
    return unauthorized(corsHeaders, options, reqId);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    logEvent("error", "reject", {
      reqId,
      caller,
      reason: "missing_env",
      hasUrl: Boolean(supabaseUrl),
      hasAnonKey: Boolean(anonKey),
      hasServiceRoleKey: Boolean(serviceRoleKey),
    });
    return unauthorized(corsHeaders, options, reqId);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    logEvent("warn", "reject", { reqId, caller, reason: "empty_token" });
    return unauthorized(corsHeaders, options, reqId);
  }

  const shape = tokenShape(token);
  const fp = tokenFingerprint(token);
  const timeoutMs = options.timeoutMs ?? DEFAULT_GETCLAIMS_TIMEOUT_MS;

  // Fast path: provably non-user tokens (anon/service_role/other) cannot
  // resolve to a user. Reject locally so a parallel burst of unauthenticated
  // calls does not serialise behind GoTrue's small outbound pool.
  const nonUser = nonUserTokenReason(token);
  if (nonUser) {
    logEvent("warn", "reject", {
      reqId,
      caller,
      reason: "non_user_token",
      detail: nonUser,
      tokenFp: fp,
      elapsedMs: Math.round(performance.now() - startedAt),
    });
    return unauthorized(corsHeaders, options, reqId);
  }

  logEvent("debug", "verify_start", {
    reqId,
    caller,
    tokenFp: fp,
    tokenLen: shape.len,
    tokenSegments: shape.segments,
    looksLikeJwt: shape.looksLikeJwt,
    timeoutMs,
  });

  let timer: number | undefined;
  const timeout = new Promise<"__timeout__">((resolve) => {
    timer = setTimeout(() => resolve("__timeout__"), timeoutMs) as unknown as number;
  });

  const verifyStartedAt = performance.now();
  let claimsResult: Awaited<ReturnType<typeof userClient.auth.getClaims>> | "__timeout__";
  try {
    claimsResult = await Promise.race([userClient.auth.getClaims(token), timeout]);
  } catch (err) {
    const verifyMs = Math.round(performance.now() - verifyStartedAt);
    logEvent("error", "reject", {
      reqId,
      caller,
      reason: "getclaims_threw",
      tokenFp: fp,
      verifyMs,
      err: err instanceof Error ? err.message : String(err),
    });
    return unauthorized(corsHeaders, options, reqId);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }

  const verifyMs = Math.round(performance.now() - verifyStartedAt);

  if (claimsResult === "__timeout__") {
    logEvent("error", "reject", {
      reqId,
      caller,
      reason: "getclaims_timeout",
      tokenFp: fp,
      verifyMs,
      timeoutMs,
      // shape helps decide whether the upstream auth server was slow or the
      // input was so broken the SDK never sent the request
      looksLikeJwt: shape.looksLikeJwt,
    });
    return unauthorized(corsHeaders, options, reqId);
  }

  const { data: claimsData, error: claimsError } = claimsResult;
  if (claimsError || !claimsData?.claims) {
    logEvent("warn", "reject", {
      reqId,
      caller,
      reason: "claims_rejected",
      tokenFp: fp,
      verifyMs,
      // Supabase returns either an AuthError with a code or null on shape
      // mismatch — surface code/status without the full message in case
      // upstream ever echoes user input.
      authErrCode: (claimsError as { code?: string } | null)?.code ?? null,
      authErrStatus: (claimsError as { status?: number } | null)?.status ?? null,
    });
    return unauthorized(corsHeaders, options, reqId);
  }

  const claims = claimsData.claims as Record<string, unknown>;
  const userId = typeof claims.sub === "string" ? claims.sub : "";
  if (!userId) {
    logEvent("warn", "reject", {
      reqId,
      caller,
      reason: "missing_sub_claim",
      tokenFp: fp,
      verifyMs,
    });
    return unauthorized(corsHeaders, options, reqId);
  }

  const email = typeof claims.email === "string" ? claims.email : null;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  logEvent("info", "verify_ok", {
    reqId,
    caller,
    tokenFp: fp,
    // user id hashed the same way as the token so we can correlate without
    // leaking the actual sub
    userFp: tokenFingerprint(userId),
    hasEmail: email !== null,
    verifyMs,
    totalMs: Math.round(performance.now() - startedAt),
  });

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

export type VerifyBearerResult =
  | { ok: true; userId: string; email: string | null; token: string; claims: Record<string, unknown>; userClient: SupabaseClient; adminClient: SupabaseClient }
  | { ok: false; reason: "missing_header" | "missing_env" | "timeout" | "invalid_token" };

/**
 * Lower-level variant for callers that need to build a custom error response
 * (e.g. functions with their own structured error contract). Same timeout
 * and validation semantics as requireAuth(), but never constructs a Response.
 */
export async function verifyBearer(
  req: Request,
  options: { timeoutMs?: number; caller?: string } = {},
): Promise<VerifyBearerResult> {
  const reqId = newRequestId();
  const caller = options.caller ?? "unknown";

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    logEvent("warn", "reject", {
      reqId,
      caller,
      api: "verifyBearer",
      reason: "missing_header",
    });
    return { ok: false, reason: "missing_header" };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    logEvent("error", "reject", {
      reqId,
      caller,
      api: "verifyBearer",
      reason: "missing_env",
      hasUrl: Boolean(supabaseUrl),
      hasAnonKey: Boolean(anonKey),
      hasServiceRoleKey: Boolean(serviceRoleKey),
    });
    return { ok: false, reason: "missing_env" };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    logEvent("warn", "reject", {
      reqId,
      caller,
      api: "verifyBearer",
      reason: "invalid_token",
      detail: "empty_after_bearer",
    });
    return { ok: false, reason: "invalid_token" };
  }

  const shape = tokenShape(token);
  const fp = tokenFingerprint(token);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const timeoutMs = options.timeoutMs ?? DEFAULT_GETCLAIMS_TIMEOUT_MS;
  let timer: number | undefined;
  const timeout = new Promise<"__timeout__">((resolve) => {
    timer = setTimeout(() => resolve("__timeout__"), timeoutMs) as unknown as number;
  });

  const verifyStartedAt = performance.now();
  let result: Awaited<ReturnType<typeof userClient.auth.getClaims>> | "__timeout__";
  try {
    result = await Promise.race([userClient.auth.getClaims(token), timeout]);
  } catch (err) {
    const verifyMs = Math.round(performance.now() - verifyStartedAt);
    logEvent("error", "reject", {
      reqId,
      caller,
      api: "verifyBearer",
      reason: "invalid_token",
      detail: "getclaims_threw",
      tokenFp: fp,
      verifyMs,
      err: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, reason: "invalid_token" };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }

  const verifyMs = Math.round(performance.now() - verifyStartedAt);

  if (result === "__timeout__") {
    logEvent("error", "reject", {
      reqId,
      caller,
      api: "verifyBearer",
      reason: "timeout",
      tokenFp: fp,
      verifyMs,
      timeoutMs,
      looksLikeJwt: shape.looksLikeJwt,
    });
    return { ok: false, reason: "timeout" };
  }
  const { data, error } = result;
  if (error || !data?.claims) {
    logEvent("warn", "reject", {
      reqId,
      caller,
      api: "verifyBearer",
      reason: "invalid_token",
      detail: "claims_rejected",
      tokenFp: fp,
      verifyMs,
      authErrCode: (error as { code?: string } | null)?.code ?? null,
      authErrStatus: (error as { status?: number } | null)?.status ?? null,
    });
    return { ok: false, reason: "invalid_token" };
  }

  const claims = data.claims as Record<string, unknown>;
  const userId = typeof claims.sub === "string" ? claims.sub : "";
  if (!userId) {
    logEvent("warn", "reject", {
      reqId,
      caller,
      api: "verifyBearer",
      reason: "invalid_token",
      detail: "missing_sub_claim",
      tokenFp: fp,
      verifyMs,
    });
    return { ok: false, reason: "invalid_token" };
  }

  logEvent("info", "verify_ok", {
    reqId,
    caller,
    api: "verifyBearer",
    tokenFp: fp,
    userFp: tokenFingerprint(userId),
    verifyMs,
  });

  return {
    ok: true,
    userId,
    email: typeof claims.email === "string" ? claims.email : null,
    token,
    claims,
    userClient,
    adminClient: createClient(supabaseUrl, serviceRoleKey),
  };
}
