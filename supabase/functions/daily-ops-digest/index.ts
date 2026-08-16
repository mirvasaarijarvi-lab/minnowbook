// Daily operations digest.
//
// Cron entrypoint. The job runs every hour and each tenant is mailed only when
// the clock reads SEND_LOCAL_HOUR in that tenant's own timezone, so the digest
// lands at the same local time all year instead of drifting with daylight
// saving. For every tenant that opted in via tenant_settings.ops_digest_enabled
// it builds the same run sheet the dashboard shows for the coming day and
// enqueues it to the configured recipients. Service-role authorization only:
// no browser ever calls this directly.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/http-headers.ts";

const SENDER_DOMAIN = "notify.mimmobook.com";
const KITCHEN_TYPES = ["restaurant", "catering", "venue"];
const LODGING_TYPES = ["hotel", "guesthouse", "cottage", "camping"];
const MAX_TENANTS_PER_RUN = 200;
export const SEND_LOCAL_HOUR = 6;
const DEFAULT_TIMEZONE = "Europe/Helsinki";


function escapeHtml(str: unknown): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Recipients come from tenant settings, so re-validate before we mail them. */
export function normalizeRecipients(raw: unknown, fallback?: unknown): string[] {
  const source = Array.isArray(raw) && raw.length > 0 ? raw : (fallback ? [fallback] : []);
  const seen = new Set<string>();
  for (const entry of source) {
    if (typeof entry !== "string") continue;
    const email = entry.trim().toLowerCase();
    if (email.length === 0 || email.length > 255) continue;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    seen.add(email);
  }
  return Array.from(seen).slice(0, 10);
}

/** Tenant timezones come from settings, so fall back when they are unusable. */
export function normalizeTimezone(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim().length === 0) return DEFAULT_TIMEZONE;
  const tz = raw.trim();
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/** Wall-clock parts for `now` as seen inside `timeZone`. */
function localParts(now: Date, timeZone: string): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

/** Local hour of the tenant, used to gate the hourly cron down to one send. */
export function tenantLocalHour(now: Date, timeZone: unknown): number {
  return localParts(now, normalizeTimezone(timeZone)).hour;
}

/**
 * The digest always covers "the day the venue is about to work", counted from
 * the tenant's own calendar rather than UTC.
 */
export function digestDate(now: Date, timeZone: unknown = DEFAULT_TIMEZONE): string {
  const today = localParts(now, normalizeTimezone(timeZone)).date;
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}


type DigestRow = {
  reservation_type: string;
  date: string;
  check_out_date: string | null;
  start_time: string | null;
  guest_name: string;
  guests_count: number | null;
  estimated_guests: number | null;
  room_type: string | null;
  dietary_notes: string | null;
  special_requests: string | null;
};

export function buildDigestHtml(businessName: string, date: string, rows: DigestRow[]): string {
  const kitchen = rows.filter((r) => KITCHEN_TYPES.includes(r.reservation_type));
  const lodging = rows.filter((r) => LODGING_TYPES.includes(r.reservation_type));
  const other = rows.filter(
    (r) => !KITCHEN_TYPES.includes(r.reservation_type) && !LODGING_TYPES.includes(r.reservation_type),
  );

  const section = (title: string, list: DigestRow[]) => {
    if (list.length === 0) return "";
    const items = list
      .map(
        (r, i) => `<tr style="background-color:${i % 2 === 0 ? "#faf8f5" : "#ffffff"}">
        <td style="padding:8px 12px;font-family:'Inter',Arial,sans-serif;font-size:13px;color:#1E1519;white-space:nowrap">${escapeHtml(r.start_time ? String(r.start_time).slice(0, 5) : "-")}</td>
        <td style="padding:8px 12px;font-family:'Inter',Arial,sans-serif;font-size:13px;color:#1E1519">${escapeHtml(r.guest_name)}</td>
        <td style="padding:8px 12px;font-family:'Inter',Arial,sans-serif;font-size:13px;color:#63516E">${escapeHtml(r.guests_count ?? r.estimated_guests ?? "-")}</td>
        <td style="padding:8px 12px;font-family:'Inter',Arial,sans-serif;font-size:13px;color:#63516E">${escapeHtml([r.room_type, r.dietary_notes, r.special_requests].filter(Boolean).join(" · ") || "-")}</td>
      </tr>`,
      )
      .join("");
    return `<h2 style="font-family:'Playfair Display',Georgia,serif;color:#1E1519;font-size:17px;margin:24px 0 8px">${escapeHtml(title)} (${list.length})</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${items}</table>`;
  };

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:32px;background:#ffffff">
  <h1 style="font-family:'Playfair Display',Georgia,serif;color:#1E1519;font-size:22px;margin:0 0 4px">${escapeHtml(businessName)}</h1>
  <p style="font-family:'Inter',Arial,sans-serif;color:#63516E;font-size:14px;margin:0">Run sheet for ${escapeHtml(date)} · ${rows.length} bookings</p>
  ${rows.length === 0 ? `<p style="font-family:'Inter',Arial,sans-serif;color:#63516E;font-size:14px;margin-top:24px">No bookings for this day.</p>` : ""}
  ${section("Kitchen", kitchen)}
  ${section("Lodging", lodging)}
  ${section("Other", other)}
</body></html>`;
}

export async function handleDailyOpsDigestRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
  const authHeader = req.headers.get("Authorization");
  if (!serviceRoleKey || authHeader !== `Bearer ${serviceRoleKey}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const date = digestDate(new Date());

    const { data: settings, error: settingsErr } = await admin
      .from("tenant_settings")
      .select("tenant_id, business_name, business_email, ops_digest_recipients")
      .eq("ops_digest_enabled", true)
      .limit(MAX_TENANTS_PER_RUN);

    if (settingsErr) {
      console.error("Failed to load digest settings", settingsErr.message);
      return json({ error: "Failed to load digest settings" }, 500);
    }

    let enqueued = 0;
    let skipped = 0;

    for (const setting of settings ?? []) {
      const recipients = normalizeRecipients(setting.ops_digest_recipients, setting.business_email);
      if (recipients.length === 0) {
        skipped++;
        continue;
      }

      const { data: tenant } = await admin
        .from("tenants")
        .select("is_active")
        .eq("id", setting.tenant_id)
        .maybeSingle();
      if (!tenant || tenant.is_active === false) {
        skipped++;
        continue;
      }

      const { data: rows } = await admin
        .from("reservations")
        .select(
          "reservation_type, date, check_out_date, start_time, guest_name, guests_count, estimated_guests, room_type, dietary_notes, special_requests",
        )
        .eq("tenant_id", setting.tenant_id)
        .neq("status", "cancelled")
        .or(`date.eq.${date},check_out_date.eq.${date}`)
        .order("start_time", { ascending: true, nullsFirst: false })
        .limit(300);

      const html = buildDigestHtml(setting.business_name || "MimmoBook", date, (rows ?? []) as DigestRow[]);

      for (const to of recipients) {
        const { error: enqueueErr } = await admin.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            to,
            from: `MimmoBook <noreply@${SENDER_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject: `Run sheet ${date} · ${setting.business_name || "MimmoBook"}`,
            html,
            purpose: "transactional",
            label: "daily_ops_digest",
            queued_at: new Date().toISOString(),
          },
        });
        if (enqueueErr) {
          console.error("Failed to enqueue digest", enqueueErr.message);
          continue;
        }
        enqueued++;
      }
    }

    return json({ success: true, date, enqueued, skipped, tenants: settings?.length ?? 0 });
  } catch (error) {
    console.error("Daily ops digest error", error);
    return json({ error: "Failed to process daily ops digest" }, 500);
  }
}

Deno.serve(handleDailyOpsDigestRequest);
