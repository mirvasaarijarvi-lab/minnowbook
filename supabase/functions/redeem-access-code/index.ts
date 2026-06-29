import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/http-headers.ts";
import { verifyBearer } from "../_shared/require-auth.ts";

/**
 * Stable, machine-readable error codes for the redeem-access-code endpoint.
 *
 * IMPORTANT: These codes are part of the public contract. Do not rename
 * existing values — only add new ones. Tests in
 * src/test/security/code-redemption-*.test.ts assert on these strings.
 *
 * Note: distinguishing between "code does not exist" and "already redeemed"
 * leaks information to attackers, so several different conditions
 * intentionally collapse to the generic INVALID_OR_UNAVAILABLE_CODE.
 */
const ERROR_CODES = {
  REQUEST_TOO_LARGE: "REQUEST_TOO_LARGE",
  NOT_AUTHENTICATED: "NOT_AUTHENTICATED",
  INVALID_CODE_FORMAT: "INVALID_CODE_FORMAT",
  INVALID_IDEMPOTENCY_KEY: "INVALID_IDEMPOTENCY_KEY",
  NO_WORKSPACE: "NO_WORKSPACE",
  /** Generic — covers not-found / inactive / revoked / expired / over-quota / already-redeemed. */
  INVALID_OR_UNAVAILABLE_CODE: "INVALID_OR_UNAVAILABLE_CODE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

const ENDPOINT_NAME = "redeem-access-code";
const IDEMPOTENCY_REPLAY_HEADER = "Idempotent-Replay";

/**
 * Structured request log. Emitted exactly ONCE per request from the
 * top-level handler so dashboards can aggregate burst behaviour:
 *   - count by `outcome` to see the rate-limit decision distribution
 *   - filter `status >= 500` to verify zero 5xx during bursts
 *   - p50/p95 of `duration_ms` to track tail latency under load
 *
 * Every field is redacted: no plaintext code, no idempotency key, no JWT.
 * Tag is a literal string so log shipping pipelines can pin a regex.
 */
type Outcome =
  | "preflight"
  | "request_too_large"
  | "not_authenticated"
  | "invalid_idempotency_key"
  | "invalid_code_format"
  | "no_workspace"
  | "invalid_or_unavailable_code"
  | "idempotent_replay"
  | "success"
  | "internal_error";

const LOG_TAG = "[redeem-access-code][telemetry]";
const LIMITER_LOG_TAG = "[redeem-access-code][limiter]";

function logRequest(entry: {
  requestId: string;
  outcome: Outcome;
  status: number;
  durationMs: number;
  userIdHash: string | null;
  hadIdempotencyKey: boolean;
  replayed: boolean;
  errorMessage?: string;
}) {
  const line = JSON.stringify({ tag: "redeem-access-code", ...entry, at: new Date().toISOString() });
  if (entry.status >= 500) {
    // Use console.error so the 5xx assertion in burst tests can grep on
    // log level without parsing the JSON payload.
    console.error(`${LOG_TAG} 5xx`, line);
  } else {
    console.info(LOG_TAG, line);
  }
}

/**
 * Stable reason codes for the limiter decision log. Two top-level
 * decisions: `allow` (the redemption proceeded past every gate) and
 * `reject` (some gate blocked it). Each carries a `reason` enum so
 * dashboards can break down the rejection mix without parsing prose.
 *
 * Reason codes are part of the operational contract — only add new
 * values, never rename existing ones.
 */
type LimiterDecision = "allow" | "reject";
type LimiterReason =
  | "ok"
  | "idempotent_replay"
  | "code_not_found"
  | "code_inactive"
  | "code_revoked"
  | "not_yet_valid"
  | "expired"
  | "max_uses_exhausted"
  | "already_redeemed_by_tenant"
  | "atomic_claim_lost_race"
  | "missing_workspace"
  | "invalid_code_format"
  | "invalid_idempotency_key"
  | "not_authenticated"
  | "request_too_large";

function logLimiterDecision(entry: {
  requestId: string;
  decision: LimiterDecision;
  reason: LimiterReason;
  userIdHash: string | null;
  tenantIdHash?: string | null;
  accessCodeIdHash?: string | null;
  /** Optional capacity context for `max_uses_exhausted` / `ok` decisions. */
  usedCount?: number | null;
  maxUses?: number | null;
  hadIdempotencyKey?: boolean;
}) {
  const line = JSON.stringify({
    tag: "redeem-access-code-limiter",
    ...entry,
    at: new Date().toISOString(),
  });
  console.info(LIMITER_LOG_TAG, line);
}

/**
 * Cheap non-cryptographic hash of the user id so logs can correlate
 * concurrent calls from the same caller without exposing the raw uuid.
 */
function shortHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).padStart(8, "0");
}



function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  corsHeaders: Record<string, string>,
  extra?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(extra ?? {}),
    },
  });
}

function errorResponse(
  corsHeaders: Record<string, string>,
  status: number,
  code: ErrorCode,
  message: string,
) {
  return jsonResponse(status, { error: message, code }, corsHeaders);
}

/**
 * Idempotency-key validation: 16-128 chars, ASCII printable, no whitespace.
 * Mirrors the DB CHECK constraint on redemption_idempotency.idempotency_key.
 * Keeping this strict prevents abuse vectors where a caller sends pathological
 * keys (very long, control chars, etc.) to spam the cache.
 */
function isValidIdempotencyKey(k: unknown): k is string {
  if (typeof k !== "string") return false;
  if (k.length < 16 || k.length > 128) return false;
  // Printable ASCII only, no whitespace.
  return /^[!-~]+$/.test(k);
}

/**
 * Persist the response so a replay with the same (user, key) returns the
 * exact same status + body. We never throw from here — a cache write
 * failure must NOT change the caller's response.
 *
 * If a row already exists (e.g. two parallel calls both got past the
 * lookup), the unique constraint on (user_id, idempotency_key, endpoint)
 * makes the second insert a no-op, and the cached row is whatever the
 * first writer stored. The replay path on subsequent requests will
 * produce a deterministic outcome regardless of which writer won.
 */
async function persistIdempotentResponse(
  admin: SupabaseClient,
  userId: string,
  key: string,
  status: number,
  body: Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await admin
      .from("redemption_idempotency")
      .insert({
        user_id: userId,
        idempotency_key: key,
        endpoint: ENDPOINT_NAME,
        response_status: status,
        response_body: body,
      });
    if (error && !/duplicate key|unique constraint/i.test(error.message)) {
      console.warn("idempotency cache write failed:", error.message);
    }
  } catch (e) {
    console.warn("idempotency cache write threw:", (e as Error).message);
  }
}

export async function handleRedeemAccessCodeRequest(req: Request): Promise<Response> {
  const startedAt = Date.now();
  const requestId =
    req.headers.get("x-request-id") ||
    (globalThis.crypto?.randomUUID?.() ?? `${startedAt}-${Math.random().toString(36).slice(2, 10)}`);
  const corsHeaders = getCorsHeaders(req, { extraAllowHeaders: "idempotency-key" });

  // Single source of truth for emitting the per-request telemetry line.
  // Every return path goes through `respond()` so dashboards see exactly
  // one log entry per request and bursts can be aggregated reliably.
  let userIdHash: string | null = null;
  let tenantIdHash: string | null = null;
  let hadIdempotencyKey = false;
  let replayed = false;
  // Captures the most recent limiter call so `respond()` can persist
  // the same {decision, reason} pair it just logged. Updated by
  // `logDecision()` below; remains null only for paths that bypass the
  // limiter entirely (preflight + raw 500 from the catch block).
  let lastLimiterDecision: {
    decision: LimiterDecision;
    reason: LimiterReason;
    accessCodeIdHash?: string | null;
    usedCount?: number | null;
    maxUses?: number | null;
  } | null = null;
  let adminClientRef: SupabaseClient | null = null;

  // Wrapper around `logLimiterDecision` that also stashes the decision so
  // `respond()` can persist a single row per request to redemption_events
  // with the same fields dashboards see in the log.
  const logDecision = (entry: Parameters<typeof logLimiterDecision>[0]) => {
    lastLimiterDecision = {
      decision: entry.decision,
      reason: entry.reason,
      accessCodeIdHash: entry.accessCodeIdHash ?? null,
      usedCount: entry.usedCount ?? null,
      maxUses: entry.maxUses ?? null,
    };
    logDecision(entry);
  };

  const respond = (
    response: Response,
    outcome: Outcome,
    errorMessage?: string,
  ): Response => {
    const durationMs = Date.now() - startedAt;
    logRequest({
      requestId,
      outcome,
      status: response.status,
      durationMs,
      userIdHash,
      hadIdempotencyKey,
      replayed,
      errorMessage,
    });
    // Fire-and-forget telemetry write. We never await — a slow or failing
    // insert must not delay or alter the caller's response. Skipped for
    // preflight and for the rare path where adminClient was never built
    // (only the 413 / 500 catch block before init).
    if (adminClientRef && outcome !== "preflight") {
      const decision = lastLimiterDecision;
      adminClientRef
        .from("redemption_events")
        .insert({
          request_id: requestId,
          outcome,
          decision: decision?.decision ?? null,
          reason: decision?.reason ?? null,
          status: response.status,
          duration_ms: durationMs,
          user_id_hash: userIdHash,
          tenant_id_hash: tenantIdHash,
          access_code_id_hash: decision?.accessCodeIdHash ?? null,
          had_idempotency_key: hadIdempotencyKey,
          replayed,
          used_count: decision?.usedCount ?? null,
          max_uses: decision?.maxUses ?? null,
          error_message: errorMessage ?? null,
        })
        .then(({ error }) => {
          if (error) console.warn("redemption_events insert failed:", error.message);
        });
    }
    // Echo the request id so callers can correlate client + server logs.
    response.headers.set("x-request-id", requestId);
    return response;
  };

  if (req.method === "OPTIONS") {
    return respond(new Response(null, { headers: corsHeaders }), "preflight");
  }

  try {
    // Reject oversized request bodies (50KB max)
    const MAX_BODY_SIZE = 50 * 1024;
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    if (contentLength > MAX_BODY_SIZE) {
      logDecision({
        requestId,
        decision: "reject",
        reason: "request_too_large",
        userIdHash,
      });
      return respond(
        errorResponse(corsHeaders, 413, ERROR_CODES.REQUEST_TOO_LARGE, "Request too large"),
        "request_too_large",
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    adminClientRef = adminClient;

    // Authenticate the calling user via the shared helper. This guarantees a
    // bounded getClaims() timeout, so a slow auth path returns 401 fast
    // instead of letting the gateway respond with 504.
    const authResult = await verifyBearer(req, { timeoutMs: 5_000 });
    if (!authResult.ok) {
      logDecision({
        requestId,
        decision: "reject",
        reason: "not_authenticated",
        userIdHash: null,
      });
      return respond(
        errorResponse(corsHeaders, 401, ERROR_CODES.NOT_AUTHENTICATED, "Not authenticated"),
        "not_authenticated",
      );
    }
    const { userId, userClient } = authResult;
    void userClient;
    userIdHash = shortHash(userId);


    const body = await req.json();
    const code = (body.code ?? "").trim().toUpperCase();

    // Optional idempotency key. Accepted from either the request body
    // (`idempotency_key`) or the standard `Idempotency-Key` header.
    const rawKey =
      (typeof body.idempotency_key === "string" ? body.idempotency_key : null) ??
      req.headers.get("Idempotency-Key") ??
      req.headers.get("idempotency-key");

    let idempotencyKey: string | null = null;
    if (rawKey !== null && rawKey !== undefined && rawKey !== "") {
      hadIdempotencyKey = true;
      if (!isValidIdempotencyKey(rawKey)) {
        logDecision({
          requestId,
          decision: "reject",
          reason: "invalid_idempotency_key",
          userIdHash,
          hadIdempotencyKey: true,
        });
        return respond(
          errorResponse(
            corsHeaders,
            400,
            ERROR_CODES.INVALID_IDEMPOTENCY_KEY,
            "idempotency_key must be 16-128 ASCII characters with no whitespace",
          ),
          "invalid_idempotency_key",
        );
      }
      idempotencyKey = rawKey;

      // Replay check, if we've seen this (user, key) before, return the
      // cached response verbatim so a second redemption is never recorded.
      const { data: cached } = await adminClient
        .from("redemption_idempotency")
        .select("response_status, response_body")
        .eq("user_id", userId)
        .eq("idempotency_key", idempotencyKey)
        .eq("endpoint", ENDPOINT_NAME)
        .maybeSingle();

      if (cached) {
        replayed = true;
        const cachedStatus = cached.response_status as number;
        logDecision({
          requestId,
          // Replays surface the previously-decided outcome verbatim. A 2xx
          // cached row means the original call was allowed; anything else
          // means it was rejected. Either way the limiter did not make a
          // fresh decision this turn.
          decision: cachedStatus >= 200 && cachedStatus < 300 ? "allow" : "reject",
          reason: "idempotent_replay",
          userIdHash,
          hadIdempotencyKey: true,
        });
        return respond(
          jsonResponse(
            cached.response_status,
            cached.response_body as Record<string, unknown>,
            corsHeaders,
            { [IDEMPOTENCY_REPLAY_HEADER]: "true" },
          ),
          "idempotent_replay",
        );
      }
    }

    // Helper that ALSO writes the response to the idempotency cache when
    // a key is present, so retries replay the same outcome. We only cache
    // deterministic outcomes (anything we explicitly produced here) and
    // never the catch-block 500, which could be a transient DB error
    // and we want the client to be free to retry without a poisoned cache.
    const finalize = async (
      status: number,
      payload: Record<string, unknown>,
    ): Promise<Response> => {
      if (idempotencyKey) {
        await persistIdempotentResponse(adminClient, userId, idempotencyKey, status, payload);
      }
      return jsonResponse(status, payload, corsHeaders);
    };

    if (!code || code.length < 3 || code.length > 50) {
      logDecision({
        requestId,
        decision: "reject",
        reason: "invalid_code_format",
        userIdHash,
        hadIdempotencyKey,
      });
      return respond(
        await finalize(400, {
          error: "Invalid access code format",
          code: ERROR_CODES.INVALID_CODE_FORMAT,
        }),
        "invalid_code_format",
      );
    }

    // Get the user's tenant
    const { data: tenantUser } = await adminClient
      .from("tenant_users")
      .select("tenant_id, role")
      .eq("user_id", userId)
      .maybeSingle();

    if (!tenantUser) {
      logDecision({
        requestId,
        decision: "reject",
        reason: "missing_workspace",
        userIdHash,
        hadIdempotencyKey,
      });
      return respond(
        await finalize(400, {
          error: "You must have a workspace before redeeming a code. Complete onboarding first.",
          code: ERROR_CODES.NO_WORKSPACE,
        }),
        "no_workspace",
      );
    }

    tenantIdHash = shortHash(tenantUser.tenant_id);

    // Look up the access code by hash via SECURITY DEFINER RPC.
    // Plaintext is never stored, only SHA-256 hash. Service role required.
    const { data: lookupRows, error: codeError } = await adminClient
      .rpc("lookup_access_code_by_plaintext", { p_code: code });

    if (codeError) throw codeError;
    const accessCode = Array.isArray(lookupRows) ? lookupRows[0] : lookupRows;

    // Generic "invalid or unavailable" payload, intentionally collapses
    // several distinguishable conditions (not found, inactive, revoked,
    // expired, out of uses, already redeemed) into one error so attackers
    // cannot classify codes via the response.
    //
    // The CLIENT-FACING payload stays generic, but the SERVER log captures
    // the precise limiter reason so operators can debug rejections.
    const invalidPayload = {
      error: "This access code is invalid or no longer available",
      code: ERROR_CODES.INVALID_OR_UNAVAILABLE_CODE,
    };
    const respondInvalid = async (reason: LimiterReason, ctx?: {
      accessCodeIdHash?: string | null;
      usedCount?: number | null;
      maxUses?: number | null;
    }) => {
      logDecision({
        requestId,
        decision: "reject",
        reason,
        userIdHash,
        tenantIdHash,
        accessCodeIdHash: ctx?.accessCodeIdHash ?? null,
        usedCount: ctx?.usedCount ?? null,
        maxUses: ctx?.maxUses ?? null,
        hadIdempotencyKey,
      });
      return respond(await finalize(400, invalidPayload), "invalid_or_unavailable_code");
    };

    if (!accessCode) return await respondInvalid("code_not_found");

    const accessCodeIdHash = shortHash(String(accessCode.id));
    const codeCtx = {
      accessCodeIdHash,
      usedCount: accessCode.used_count ?? null,
      maxUses: accessCode.max_uses ?? null,
    };

    if (!accessCode.is_active) return await respondInvalid("code_inactive", codeCtx);
    if (accessCode.is_revoked) return await respondInvalid("code_revoked", codeCtx);

    // Check date validity
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (accessCode.valid_from && new Date(accessCode.valid_from) > now) {
      return await respondInvalid("not_yet_valid", codeCtx);
    }
    if (accessCode.valid_until && new Date(accessCode.valid_until) < now) {
      return await respondInvalid("expired", codeCtx);
    }

    // Check usage limits
    if (accessCode.max_uses !== null && accessCode.used_count >= accessCode.max_uses) {
      return await respondInvalid("max_uses_exhausted", codeCtx);
    }

    // Check if this user already redeemed this code for their tenant
    const { data: existing } = await adminClient
      .from("access_code_redemptions")
      .select("id")
      .eq("access_code_id", accessCode.id)
      .eq("tenant_id", tenantUser.tenant_id)
      .maybeSingle();

    if (existing) return await respondInvalid("already_redeemed_by_tenant", codeCtx);

    // Calculate granted_until
    const grantedUntil = new Date();
    grantedUntil.setDate(grantedUntil.getDate() + accessCode.duration_days);
    const grantedUntilStr = grantedUntil.toISOString().split("T")[0];

    // Atomically claim the code: locks the access_codes row, re-checks
    // limits, inserts the redemption, increments used_count, and updates
    // the tenant tier inside one transaction. Prevents two tenants from
    // over-redeeming a single-use code under concurrent requests.
    const { data: claimResult, error: claimError } = await adminClient
      .rpc("claim_access_code", {
        p_access_code_id: accessCode.id,
        p_tenant_id: tenantUser.tenant_id,
        p_user_id: userId,
        p_granted_tier: accessCode.tier,
        p_granted_until: grantedUntilStr,
        p_duration_days: accessCode.duration_days,
      });

    if (claimError) throw claimError;
    const claim = Array.isArray(claimResult) ? claimResult[0] : claimResult;

    if (!claim?.success) {
      // Pre-claim gates already passed, so reaching here means we lost the
      // atomic race (another concurrent caller exhausted the last slot or
      // beat us to the tenant-level uniqueness check). Logged distinctly so
      // dashboards can separate "user-facing limit reached" from
      // "limiter contention under burst".
      return await respondInvalid("atomic_claim_lost_race", codeCtx);
    }

    logDecision({
      requestId,
      decision: "allow",
      reason: "ok",
      userIdHash,
      tenantIdHash,
      accessCodeIdHash,
      usedCount: accessCode.used_count ?? null,
      maxUses: accessCode.max_uses ?? null,
      hadIdempotencyKey,
    });
    return respond(
      await finalize(200, {
        success: true,
        tier: accessCode.tier,
        granted_until: grantedUntilStr,
        duration_days: accessCode.duration_days,
      }),
      "success",
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("redeem-access-code unexpected error:", message);
    // Intentionally NOT cached, transient errors should be retryable.
    return respond(
      errorResponse(corsHeaders, 500, ERROR_CODES.INTERNAL_ERROR, "Internal error"),
      "internal_error",
      message,
    );
  }
}
Deno.serve(handleRedeemAccessCodeRequest);

