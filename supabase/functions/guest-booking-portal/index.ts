import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/http-headers.ts";

const SENDER_DOMAIN = "notify.mimmobook.com";
const TOKEN_TTL_DAYS = 7;
const MAX_LOOKUP_RESULTS = 5;

function escapeHtml(str: unknown): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// --- Rate limiting: 5 requests per IP per minute ---
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
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

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 300_000);

// --- Validation helpers (pure, exported for unit tests) ---
export function validateEmail(val: unknown): string {
  if (typeof val !== "string") throw new Error("Invalid email");
  const s = val.trim().toLowerCase();
  if (s.length === 0 || s.length > 255) throw new Error("Invalid email");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new Error("Invalid email");
  return s;
}

export function validateDate(val: unknown): string {
  if (typeof val !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    throw new Error("Invalid date");
  }
  const parsed = new Date(`${val}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid date");
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (parsed < today) throw new Error("Date must be in the future");
  const maxAhead = new Date(today.getTime() + 400 * 24 * 60 * 60 * 1000);
  if (parsed > maxAhead) throw new Error("Date too far ahead");
  return val;
}

export function validateTime(val: unknown): string | null {
  if (val === undefined || val === null || val === "") return null;
  if (typeof val !== "string" || !/^\d{2}:\d{2}(:\d{2})?$/.test(val)) {
    throw new Error("Invalid time");
  }
  return val.length === 5 ? `${val}:00` : val;
}

export function validateNote(val: unknown): string | null {
  if (val === undefined || val === null || val === "") return null;
  if (typeof val !== "string") throw new Error("Invalid note");
  const trimmed = val.trim();
  if (trimmed.length > 1000) throw new Error("Note too long");
  return trimmed.length > 0 ? trimmed : null;
}

export function validateToken(val: unknown): string {
  if (typeof val !== "string") throw new Error("Invalid token");
  const trimmed = val.trim();
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(trimmed)) throw new Error("Invalid token");
  return trimmed;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const lookupCopy: Record<string, { subject: string; title: string; intro: string; none: string; footer: string }> = {
  en: {
    subject: "Your booking links",
    title: "Your bookings",
    intro: "Here are secure links to your upcoming bookings. They expire in 7 days.",
    none: "We could not find any upcoming bookings for this email address.",
    footer: "If you did not request this email, you can safely ignore it.",
  },
  fi: {
    subject: "Varauslinkkisi",
    title: "Varauksesi",
    intro: "Tässä ovat turvalliset linkit tuleviin varauksiisi. Linkit vanhenevat 7 päivässä.",
    none: "Emme löytäneet tulevia varauksia tälle sähköpostiosoitteelle.",
    footer: "Jos et pyytänyt tätä viestiä, voit jättää sen huomiotta.",
  },
  sv: {
    subject: "Dina bokningslänkar",
    title: "Dina bokningar",
    intro: "Här är säkra länkar till dina kommande bokningar. Länkarna gäller i 7 dagar.",
    none: "Vi hittade inga kommande bokningar för den här e-postadressen.",
    footer: "Om du inte begärde detta meddelande kan du ignorera det.",
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
  if (!serviceRoleKey || !supabaseUrl) {
    return json({ error: "Guest portal is not fully configured. Please contact the venue." }, 400);
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(ip)) {
    return json({ error: "Too many requests. Please try again in a minute." }, 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const action = typeof body.action === "string" ? body.action : "";
  const origin = typeof body.origin === "string" && /^https:\/\/[a-z0-9.-]+$/i.test(body.origin)
    ? body.origin
    : "https://mimmobook.com";

  try {
    if (action === "lookup") {
      const email = validateEmail(body.email);
      const language = ["en", "fi", "sv"].includes(String(body.language)) ? String(body.language) : "en";
      const copy = lookupCopy[language];
      const today = new Date().toISOString().slice(0, 10);

      const { data: reservations } = await admin
        .from("reservations")
        .select("id, tenant_id, date, start_time, reservation_type, guest_name, status")
        .ilike("guest_email", email)
        .gte("date", today)
        .neq("status", "cancelled")
        .order("date", { ascending: true })
        .limit(MAX_LOOKUP_RESULTS);

      const rows: string[] = [];
      for (const res of reservations ?? []) {
        const token = newToken();
        const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
        const { error: tokenErr } = await admin.from("booking_tokens").insert({
          reservation_id: res.id,
          tenant_id: res.tenant_id,
          token,
          expires_at: expiresAt,
        });
        if (tokenErr) {
          console.error("Failed to mint booking token", tokenErr.message);
          continue;
        }
        const url = `${origin}/my-booking/${token}`;
        rows.push(
          `<tr><td style="padding:10px 0;border-bottom:1px solid #e8e0d8;font-family:'Inter',Arial,sans-serif;font-size:14px;color:#63516E">` +
            `<strong style="color:#1E1519">${escapeHtml(res.date)}${res.start_time ? ` ${escapeHtml(String(res.start_time).slice(0, 5))}` : ""}</strong> · ${escapeHtml(res.reservation_type)}<br>` +
            `<a href="${url}" style="color:#9B2C4A">${escapeHtml(url)}</a></td></tr>`,
        );
      }

      if (rows.length > 0) {
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Inter',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0"><tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0">
      <tr><td style="padding:0 32px 24px">
        <h1 style="color:#1E1519;font-size:22px;font-family:'Playfair Display',Georgia,serif;margin:0 0 12px">${copy.title}</h1>
        <p style="color:#63516E;font-size:15px;line-height:1.6;margin:0 0 16px">${copy.intro}</p>
        <table width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table>
        <p style="color:#999;font-size:12px;margin-top:24px">${copy.footer}</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

        try {
          await admin.rpc("enqueue_email", {
            queue_name: "transactional_emails",
            payload: {
              to: email,
              from: `MimmoBook <noreply@${SENDER_DOMAIN}>`,
              sender_domain: SENDER_DOMAIN,
              subject: copy.subject,
              html,
              purpose: "transactional",
              label: "guest_booking_lookup",
              queued_at: new Date().toISOString(),
            },
          });
        } catch (mailErr) {
          console.error("Failed to enqueue lookup email", mailErr);
        }
      }

      // Always generic: never reveal whether the email exists.
      return json({ ok: true });
    }

    if (action === "reschedule") {
      const token = validateToken(body.token);
      const requestedDate = validateDate(body.requested_date);
      const requestedStart = validateTime(body.requested_start_time);
      const requestedEnd = validateTime(body.requested_end_time);
      const note = validateNote(body.guest_note);

      const { data: tokenRow } = await admin
        .from("booking_tokens")
        .select("reservation_id, tenant_id, is_revoked, expires_at")
        .eq("token", token)
        .maybeSingle();

      if (!tokenRow || tokenRow.is_revoked || new Date(tokenRow.expires_at) < new Date()) {
        return json({ error: "This booking link is no longer valid." }, 403);
      }

      const { data: reservation } = await admin
        .from("reservations")
        .select("id, tenant_id, status, date, guest_name")
        .eq("id", tokenRow.reservation_id)
        .eq("tenant_id", tokenRow.tenant_id)
        .maybeSingle();

      if (!reservation) return json({ error: "Booking not found." }, 404);
      if (reservation.status === "cancelled") {
        return json({ error: "This booking has been cancelled." }, 409);
      }

      const { data: existing } = await admin
        .from("reschedule_requests")
        .select("id")
        .eq("reservation_id", reservation.id)
        .eq("status", "pending")
        .maybeSingle();

      if (existing) {
        return json({ error: "A change request is already pending for this booking." }, 409);
      }

      const { data: inserted, error: insertErr } = await admin
        .from("reschedule_requests")
        .insert({
          tenant_id: reservation.tenant_id,
          reservation_id: reservation.id,
          requested_date: requestedDate,
          requested_start_time: requestedStart,
          requested_end_time: requestedEnd,
          guest_note: note,
        })
        .select("id, requested_date, requested_start_time, status")
        .single();

      if (insertErr) {
        console.error("Failed to store reschedule request", insertErr.message);
        return json({ error: "Could not save your request. Please try again." }, 500);
      }

      try {
        await admin.from("notifications").insert({
          tenant_id: reservation.tenant_id,
          reservation_id: reservation.id,
          type: "reschedule_request",
          title: "Guest requested a new date",
          message: `${reservation.guest_name} asked to move their booking from ${reservation.date} to ${requestedDate}${requestedStart ? ` at ${requestedStart.slice(0, 5)}` : ""}.`,
        });
      } catch (notifyErr) {
        console.error("Failed to create reschedule notification", notifyErr);
      }

      return json({ ok: true, request: inserted });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return json({ error: message }, 400);
  }
});
