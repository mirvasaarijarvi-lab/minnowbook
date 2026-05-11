import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPPORT_CHAT_SYSTEM_PROMPT } from "./prompt.ts";

// CORS + transport-security headers come from the shared module so the
// triad cannot drift across edge functions. We re-import the allowlist
// for the rejection-alert payload below.
import {
  getCorsHeaders,
  isOriginAllowed,
  DEFAULT_ALLOWED_ORIGINS as ALLOWED_ORIGINS,
} from "../_shared/http-headers.ts";


function getJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}


// --- Rate limiting ---
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 20; // max requests per window per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

// Cleanup stale entries periodically (every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 300_000);

/**
 * Exported so integration tests can drive every request branch
 * in-process (OPTIONS, 403, 413, 429, catch-block 500, etc.) and
 * assert that the shared SECURITY_HEADERS are present on every
 * Response.
 */
export const handleSupportChatRequest = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req, { allowMethods: "POST, OPTIONS" });
  const reqOrigin = req.headers.get("Origin") || "";
  const referer = req.headers.get("Referer") || "";
  const userAgent = req.headers.get("User-Agent") || "";

  console.log("[support-chat] request", {
    method: req.method,
    origin: reqOrigin || "(none)",
    referer: referer || "(none)",
    userAgent: userAgent.slice(0, 120),
  });

  if (req.method === "OPTIONS") {
    console.log("[support-chat] preflight", {
      origin: reqOrigin || "(none)",
      originAllowed: reqOrigin ? isOriginAllowed(reqOrigin) : true,
    });
    return new Response(null, { headers: corsHeaders });
  }

  // Health/status endpoint: GET /support-chat/health (or /status).
  // Returns 200 with CORS + environment configuration check. Safe to expose:
  // it only reports presence of required env vars, never their values.
  const url = new URL(req.url);
  const pathTail = url.pathname.split("/").pop() || "";
  if (req.method === "GET" && (pathTail === "health" || pathTail === "status")) {
    const hasLovableKey = !!Deno.env.get("LOVABLE_API_KEY");
    const hasSupabaseUrl = !!Deno.env.get("SUPABASE_URL");
    const hasAnonKey = !!Deno.env.get("SUPABASE_ANON_KEY");
    const originAllowed = reqOrigin ? isOriginAllowed(reqOrigin) : null;
    const ok = hasLovableKey && hasSupabaseUrl && hasAnonKey;
    const body = {
      status: ok ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      cors: {
        requestOrigin: reqOrigin || null,
        originAllowed,
        allowOriginEcho: corsHeaders["Access-Control-Allow-Origin"] ?? null,
      },
      env: {
        LOVABLE_API_KEY: hasLovableKey,
        SUPABASE_URL: hasSupabaseUrl,
        SUPABASE_ANON_KEY: hasAnonKey,
      },
    };
    return new Response(JSON.stringify(body), {
      status: ok ? 200 : 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Origin allowlist gate: explicit 403 for browser requests from
  // disallowed origins. Body is intentionally generic to avoid leaking
  // any allowlist or routing details.
  if (reqOrigin && !isOriginAllowed(reqOrigin)) {
    console.warn("[support-chat] rejected: origin not in allowlist", {
      origin: reqOrigin,
      reason: "origin_not_allowlisted",
      allowlist: ALLOWED_ORIGINS.map((o) => (typeof o === "string" ? o : o.toString())),
    });
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Rate limit check
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") || "unknown";
  if (!checkRateLimit(clientIp)) {
    return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
    });
  }

  try {
    // Reject oversized request bodies (50KB max)
    const MAX_BODY_SIZE = 50 * 1024;
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    if (contentLength > MAX_BODY_SIZE) {
      return new Response(JSON.stringify({ error: "Request too large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Authentication is OPTIONAL: the support chat widget also renders on
    // public pages (landing/marketing). If a real signed-in user Bearer token
    // is sent, we validate it for future user-aware behavior. Anonymous keys,
    // missing tokens, expired sessions, or malformed tokens are treated as an
    // anonymous visitor because this endpoint does not expose private data.
    const authHeader = req.headers.get("Authorization");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const bearer = authHeader?.replace(/^Bearer\s+/i, "").trim();
    const payload = bearer ? getJwtPayload(bearer) : null;
    const isAuthenticatedUserToken = payload?.role === "authenticated" && typeof payload?.sub === "string";
    if (bearer && bearer !== anonKey && isAuthenticatedUserToken) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabase = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader! } },
      });
      const { data: { user }, error: authError } = await supabase.auth.getUser(bearer);
      if (authError || !user) {
        console.warn("support-chat continuing as anonymous after invalid optional session");
      }
    }


    const body = await req.json();

    // --- Input validation ---
    const { messages } = body;

    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages must be an array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MAX_MESSAGES = 50;
    const MAX_MESSAGE_LENGTH = 4000;
    const VALID_ROLES = ["user", "assistant"];

    if (messages.length === 0 || messages.length > MAX_MESSAGES) {
      return new Response(JSON.stringify({ error: `messages must contain 1-${MAX_MESSAGES} items` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const msg of messages) {
      if (!msg || typeof msg !== "object") {
        return new Response(JSON.stringify({ error: "Each message must be an object" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!VALID_ROLES.includes(msg.role)) {
        return new Response(JSON.stringify({ error: `Invalid message role. Allowed: ${VALID_ROLES.join(", ")}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (typeof msg.content !== "string" || msg.content.trim().length === 0) {
        return new Response(JSON.stringify({ error: "Message content must be a non-empty string" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (msg.content.length > MAX_MESSAGE_LENGTH) {
        return new Response(JSON.stringify({ error: `Message content must be at most ${MAX_MESSAGE_LENGTH} characters` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Sanitize messages to only pass role + content
    const sanitizedMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content.trim(),
    }));

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: SUPPORT_CHAT_SYSTEM_PROMPT,
            },
            ...sanitizedMessages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Support chat is temporarily unavailable." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("support-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handleSupportChatRequest);
