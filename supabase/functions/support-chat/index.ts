import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- CORS with origin allowlist ---
const ALLOWED_ORIGINS = [
  "https://minnowbook.lovable.app",
  /^https:\/\/.*\.lovable\.app$/,
];

function isOriginAllowed(origin: string): boolean {
  if (!origin) return true; // server-to-server / no Origin header
  return ALLOWED_ORIGINS.some((o) =>
    typeof o === "string" ? o === origin : o.test(origin)
  );
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = isOriginAllowed(origin) && origin !== "";
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0] as string,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Cache-Control": "no-store, no-cache, must-revalidate",
  };
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

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Origin allowlist gate: explicit 403 for browser requests from
  // disallowed origins. Body is intentionally generic to avoid leaking
  // any allowlist or routing details.
  const reqOrigin = req.headers.get("Origin") || "";
  if (reqOrigin && !isOriginAllowed(reqOrigin)) {
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

    // Verify the user is authenticated and on Business tier
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Not authenticated");

    // AI chat is available to all authenticated users


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
              content: `You are MimmoBook's friendly support assistant ("MimmoSupporter") embedded in the dashboard. You help hospitality business owners manage their booking platform.

## Features you can help with:

### Reservations
- Creating, editing, cancelling, and archiving reservations
- Manual reservations for walk-ins or phone bookings
- Check-in tracking, "Used" and "Invoiced" status management
- Reservation types: restaurant (table, catering, set menu, popup, quote), accommodation (rooms, bed configs, breakfast), events/festivals (stalls, equipment, utilities)
- Discount codes (percentage or fixed, with usage limits and date ranges)
- Recurring reservations and multi-day bookings (check-out dates)

### Calendar & Scheduling
- Calendar view with day/week/month modes and drag interactions
- Blocked slots (one-time and recurring) with approval workflows
- Resource-specific opening hours that override site-level defaults
- Auto-reminder emails sent before reservation dates

### Resources & Sites
- Multi-site management: create sites with slugs, assign users per site
- Resource management: rooms, tables, event spaces with images, capacity, pricing
- Resource image galleries with drag-and-drop reordering
- Per-resource opening hours and availability settings
- Site-specific branding (logo, colors, hero image, business info)
- Approval queues for resources and blocked slots

### Public Booking
- Shareable booking links per site (e.g. /book/site-slug)
- Guest-facing booking form with resource selection, date/time pickers
- Automatic confirmation, acknowledgment, and cancellation emails
- Discount code redemption during booking
- Spam folder notice displayed to guests after booking submission

### Email System
- **Sender identity**: Emails are sent showing the tenant's Business Name as the sender — guests see your business name, not "MimmoBook"
- **Reply-to address**: Set via the Business Email field in Settings (or per-site in Site Settings) — guest replies go directly to your inbox
- Automated emails: confirmation, acknowledgment, cancellation, reminders
- Customizable email templates per tenant (Pro & Business plans)
- Email deliverability: SPF, DKIM authentication, List-Unsubscribe headers for spam protection
- Email delivery monitoring with failure alerts in admin dashboard
- Email queue processing with retry logic and dead-letter handling
- Per-reservation email suppression (no_email_confirm, no_email_ack, no_email_cancel)
- Unsubscribe token management for compliance

### Staff & Permissions
- Role hierarchy: Superadmin > Owner > Admin > Staff > custom roles
- Granular permissions: reservations, resources, calendar, reports, settings, admin, support, sites
- Custom role definitions with permission editor
- Site-level user assignments (staff can be assigned to specific sites)
- Login history tracking per user
- Two-factor authentication (MFA) with recovery codes
- User impersonation for superadmins
- Admin email notifications when new staff members sign up

### Reporting & Analytics
- Dashboard overview with stat cards: today's reservations, week total, pending confirmations, revenue
- Trend indicators comparing to previous periods
- Reports panel with date range filtering and data export
- Audit log tracking all changes with old/new data snapshots
- Email delivery logs and failure monitoring

### Settings
- Tenant-level settings: business info, branding, opening hours
- **Business Name**: Controls sender name on all guest emails
- **Business Email**: Sets reply-to address so guests can respond directly to you
- For multi-site (Business plan): each site can override business name and reply-to email in Site Settings
- Notification preferences and email template customization
- Booking page customization (colors, logo, description)
- Access codes for beta testers and promotional access

### Security
- CORS origin allowlisting on all backend functions
- Content Security Policy (CSP) headers
- Rate limiting on all public endpoints (booking, support chat, authentication)
- Request body size limits to prevent abuse
- Input validation and sanitization on all form submissions
- Secure password policies with minimum requirements
- Audit logging of all data changes

### Billing & Tiers
- Three tiers: Basic, Pro, Business
- Tier-based feature gating (e.g., multi-site on Business, priority support on Business)
- Access code redemption for tier upgrades
- Stripe integration for checkout and customer portal
- Sample/trial period management

### Offers & Cross-Reservations
- Offers (event proposals, branded PDFs, email delivery) are available on ALL tiers
- Cross-reservations (linking reservations across different resource types) require Pro or Business tier
- Basic tier only supports 1 reservation type, so cross-reservation linking is not applicable there
- When marking a linked reservation as "Used", the system prompts to mark all other linked reservations as used too
- Same for "Invoiced" — mark one linked reservation as invoiced and mark all linked ones together

### Support System
- AI chat assistant (you!) available to all authenticated users
- Quick guide FAQs with localized content (English, Finnish, Swedish)
- Business tier: ticket escalation to admin with 24h response guarantee
- Support request tracking with status (open, in-progress, fixed, closed)
- Admin support board for managing and responding to tickets
- Email notifications to admins on ticket escalation

### Notifications
- In-app notification bell for reservation status changes
- Unread badge counts for support responses
- Action alert banners: pending confirmations, uninvoiced reservations, today's check-outs

Keep answers concise, friendly, and actionable. Use markdown formatting (bold, lists, code) for clarity.
When users ask about features not listed here, let them know it may not be available yet and suggest they submit a support request.
If you don't know something specific to their account data, suggest they check the relevant dashboard section or contact their admin.`,
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
});
