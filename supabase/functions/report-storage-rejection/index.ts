// report-storage-rejection
//
// Ingests a single safe-shape rejection event from the client-side
// assertSafeStorageObjectPath sanitiser, persists it to
// storage_rejection_events, and evaluates three spike-detection
// scopes over a trailing window:
//
//   - tenant            (events for a single tenant_id)
//   - callsite          (events for a single callsite tag)
//   - tenant_callsite   (events for one tenant_id at one callsite)
//
// When a scope's rolling count exceeds its threshold AND no
// unresolved alert for that scope key exists in the dedup window,
// an alert row is inserted into storage_rejection_alerts so the
// superadmin dashboard / SIEM can surface it.
//
// Hard rules:
//   * NEVER trust client-supplied input. The body is validated against
//     a strict allowlist; the raw path is NEVER accepted (the client
//     module is built to never send it). We also re-strip and re-cap
//     callsite, tenantId, and reason here.
//   * NEVER include the request payload in any response, alert row,
//     or log line that an unauthenticated party could read.
//   * NEVER fail the calling page render. The client invokes this
//     fire-and-forget; on any error we still return 200 with a small
//     JSON body so the browser never bubbles it up.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Tunable via env so an operator can ratchet thresholds without a
// code change. All windows are in MINUTES.
const SPIKE_WINDOW_MINUTES = Number(Deno.env.get("STORAGE_REJ_WINDOW_MIN") ?? "10");
const DEDUP_WINDOW_MINUTES = Number(Deno.env.get("STORAGE_REJ_DEDUP_MIN") ?? "60");
const TENANT_THRESHOLD = Number(Deno.env.get("STORAGE_REJ_TENANT_THRESHOLD") ?? "50");
const CALLSITE_THRESHOLD = Number(Deno.env.get("STORAGE_REJ_CALLSITE_THRESHOLD") ?? "100");
const TENANT_CALLSITE_THRESHOLD = Number(
  Deno.env.get("STORAGE_REJ_TENANT_CALLSITE_THRESHOLD") ?? "25",
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
};

// ---------------------------------------------------------------------------
// Validation. We intentionally accept ONLY the safe-shape fields. Any
// other key on the body is dropped; if "path", "input", "raw", "value",
// or "payload" appears we hard-reject with 400 since that is a client-
// side regression we want to catch loudly.
// ---------------------------------------------------------------------------
const ALLOWED_REASONS = new Set([
  "not_a_string",
  "empty",
  "too_long",
  "control_char",
  "backslash",
  "scheme",
  "absolute",
  "traversal_or_empty_segment",
]);
const ALLOWED_LEADING_CLASSES = new Set([
  "alnum", "slash", "dot", "control", "other", "none",
]);
const FORBIDDEN_BODY_KEYS = new Set([
  "path", "input", "raw", "value", "payload", "rawInput",
]);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SafeEvent {
  tenant_id: string | null;
  callsite: string | null;
  reason: string;
  input_length: number;
  segment_count: number | null;
  leading_char_class: string;
  has_scheme_shape: boolean;
  has_backslash: boolean;
  has_control_char: boolean;
}

function clampInt(v: unknown, lo: number, hi: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : 0;
  return Math.max(lo, Math.min(hi, n));
}

function parseBody(body: unknown): { event: SafeEvent } | { error: string } {
  if (!body || typeof body !== "object") return { error: "body_not_object" };
  const b = body as Record<string, unknown>;

  for (const k of Object.keys(b)) {
    if (FORBIDDEN_BODY_KEYS.has(k)) {
      return { error: `forbidden_field:${k}` };
    }
  }

  const reason = typeof b.reason === "string" ? b.reason : "";
  if (!ALLOWED_REASONS.has(reason)) return { error: "invalid_reason" };

  const leading_char_class =
    typeof b.leadingCharClass === "string" ? b.leadingCharClass : "none";
  if (!ALLOWED_LEADING_CLASSES.has(leading_char_class)) {
    return { error: "invalid_leading_class" };
  }

  let tenant_id: string | null = null;
  if (typeof b.tenantId === "string") {
    const trimmed = b.tenantId.trim().toLowerCase();
    if (UUID_RE.test(trimmed)) tenant_id = trimmed;
    // Non-UUID values are silently dropped, not echoed back, never
    // persisted. Mirrors safeTenantId() in the client module.
  }

  let callsite: string | null = null;
  if (typeof b.callsite === "string") {
    const trimmed = b.callsite.trim().slice(0, 80);
    // Restrict to a printable, ascii-ish tag set so an attacker cannot
    // smuggle PII or control bytes via this field.
    if (/^[A-Za-z0-9._:\\-/+]{1,80}$/.test(trimmed)) callsite = trimmed;
  }

  return {
    event: {
      tenant_id,
      callsite,
      reason,
      input_length: clampInt(b.inputLength, 0, 4096),
      segment_count:
        b.segmentCount === null || b.segmentCount === undefined
          ? null
          : clampInt(b.segmentCount, 0, 1024),
      leading_char_class,
      has_scheme_shape: Boolean(b.hasSchemeShape),
      has_backslash: Boolean(b.hasBackslash),
      has_control_char: Boolean(b.hasControlChar),
    },
  };
}

// ---------------------------------------------------------------------------
// Spike evaluation. For each scope we:
//   1. count events in the trailing SPIKE_WINDOW_MINUTES window
//   2. if count >= threshold, look for an unresolved alert with the
//      same scope key in the last DEDUP_WINDOW_MINUTES
//   3. if none, insert a new alert row
// ---------------------------------------------------------------------------
type SupabaseClient = ReturnType<typeof createClient>;

interface ScopeCheck {
  scope: "tenant" | "callsite" | "tenant_callsite";
  tenantId: string | null;
  callsite: string | null;
  threshold: number;
}

async function evaluateScope(
  sb: SupabaseClient,
  check: ScopeCheck,
): Promise<{ raised: boolean; count: number }> {
  const since = new Date(Date.now() - SPIKE_WINDOW_MINUTES * 60_000).toISOString();
  let q = sb
    .from("storage_rejection_events")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);

  if (check.tenantId !== null) q = q.eq("tenant_id", check.tenantId);
  else q = q.is("tenant_id", null);
  if (check.callsite !== null) q = q.eq("callsite", check.callsite);
  else if (check.scope === "callsite") q = q.is("callsite", null);
  // For "tenant" scope we deliberately do NOT constrain on callsite,
  // so the count aggregates across every callsite for that tenant.

  const { count, error } = await q;
  if (error) {
    console.error("[report-storage-rejection] count failed", error.message);
    return { raised: false, count: 0 };
  }
  const eventCount = count ?? 0;
  if (eventCount < check.threshold) return { raised: false, count: eventCount };

  // Dedup: any unresolved alert with the same key in the dedup window?
  const dedupSince = new Date(
    Date.now() - DEDUP_WINDOW_MINUTES * 60_000,
  ).toISOString();
  let dq = sb
    .from("storage_rejection_alerts")
    .select("id", { count: "exact", head: true })
    .eq("scope", check.scope)
    .is("resolved_at", null)
    .gte("created_at", dedupSince);
  if (check.tenantId !== null) dq = dq.eq("tenant_id", check.tenantId);
  else dq = dq.is("tenant_id", null);
  if (check.callsite !== null) dq = dq.eq("callsite", check.callsite);
  else dq = dq.is("callsite", null);

  const { count: existing, error: dErr } = await dq;
  if (dErr) {
    console.error("[report-storage-rejection] dedup query failed", dErr.message);
    return { raised: false, count: eventCount };
  }
  if ((existing ?? 0) > 0) return { raised: false, count: eventCount };

  const windowStart = since;
  const windowEnd = new Date().toISOString();
  const { error: insErr } = await sb
    .from("storage_rejection_alerts")
    .insert({
      scope: check.scope,
      tenant_id: check.tenantId,
      callsite: check.callsite,
      window_start: windowStart,
      window_end: windowEnd,
      event_count: eventCount,
      threshold: check.threshold,
    });
  if (insErr) {
    console.error("[report-storage-rejection] alert insert failed", insErr.message);
    return { raised: false, count: eventCount };
  }
  console.warn(
    "[report-storage-rejection] spike alert raised",
    JSON.stringify({
      scope: check.scope,
      tenant_id: check.tenantId,
      callsite: check.callsite,
      event_count: eventCount,
      threshold: check.threshold,
      window_minutes: SPIKE_WINDOW_MINUTES,
    }),
  );
  return { raised: true, count: eventCount };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const parsed = parseBody(raw);
  if ("error" in parsed) {
    return new Response(JSON.stringify({ error: parsed.error }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const ev = parsed.event;

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: insertErr } = await sb
    .from("storage_rejection_events")
    .insert(ev);
  if (insertErr) {
    console.error("[report-storage-rejection] event insert failed", insertErr.message);
    // Soft-fail so the browser keeps rendering. The 502 lets a SIEM
    // notice ingestion problems without breaking the user's page.
    return new Response(JSON.stringify({ error: "ingest_failed" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Run spike evaluations in parallel. Failures are logged but never
  // propagated to the response.
  const checks: ScopeCheck[] = [];
  if (ev.tenant_id) {
    checks.push({
      scope: "tenant",
      tenantId: ev.tenant_id,
      callsite: null,
      threshold: TENANT_THRESHOLD,
    });
  }
  if (ev.callsite) {
    checks.push({
      scope: "callsite",
      tenantId: null,
      callsite: ev.callsite,
      threshold: CALLSITE_THRESHOLD,
    });
  }
  if (ev.tenant_id && ev.callsite) {
    checks.push({
      scope: "tenant_callsite",
      tenantId: ev.tenant_id,
      callsite: ev.callsite,
      threshold: TENANT_CALLSITE_THRESHOLD,
    });
  }

  const results = await Promise.all(checks.map((c) => evaluateScope(sb, c)));
  const alertsRaised = results.filter((r) => r.raised).length;

  return new Response(
    JSON.stringify({
      ok: true,
      alerts_raised: alertsRaised,
      scopes_evaluated: checks.length,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
