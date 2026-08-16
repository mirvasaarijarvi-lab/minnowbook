// Weekly operations report.
//
// Cron entrypoint. The job runs hourly and a tenant is mailed only when its own
// local clock reads SEND_LOCAL_HOUR on its configured weekday, so the report
// lands at the same local time all year regardless of daylight saving.
// The mail contains a per-day summary of the coming seven days plus a CSV
// block that staff can copy straight into a spreadsheet, because the email
// queue carries no file attachments.
//
// Staff can also POST `{ "test": true }` with their own session to preview the
// report for their tenant, bypassing both the opt-in flag and the time gate.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/http-headers.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import {
  addDaysIso,
  normalizeTimezone,
  tenantLocalDate,
  tenantLocalHour,
  tenantLocalWeekday,
} from "../_shared/tenant-time.ts";

const SENDER_DOMAIN = "notify.mimmobook.com";
const MAX_TENANTS_PER_RUN = 200;
const MAX_ROWS = 1000;
export const SEND_LOCAL_HOUR = 6;
export const REPORT_DAYS = 7;

export type ReportRow = {
  reservation_type: string;
  status: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  guest_name: string;
  guests_count: number | null;
  estimated_guests: number | null;
  price_eur: number | null;
};

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

/** Weekday setting is user supplied, so clamp it into 0 to 6. */
export function normalizeWeekday(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  const i = Math.trunc(n);
  return i >= 0 && i <= 6 ? i : 1;
}

const guestsOf = (r: ReportRow) => r.guests_count ?? r.estimated_guests ?? 0;

export type DaySummary = {
  date: string;
  reservations: number;
  guests: number;
  revenue: number;
};

/** Per-day rollup covering every day in the window, including empty ones. */
export function summarizeByDay(startDate: string, rows: ReportRow[]): DaySummary[] {
  const days: DaySummary[] = [];
  for (let i = 0; i < REPORT_DAYS; i++) {
    const date = addDaysIso(startDate, i);
    const dayRows = rows.filter((r) => r.date === date);
    days.push({
      date,
      reservations: dayRows.length,
      guests: dayRows.reduce((sum, r) => sum + guestsOf(r), 0),
      revenue: Math.round(dayRows.reduce((sum, r) => sum + Number(r.price_eur ?? 0), 0) * 100) / 100,
    });
  }
  return days;
}

/** RFC 4180 style quoting, guarding against spreadsheet formula injection. */
function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildReportCsv(rows: ReportRow[]): string {
  const header = ["date", "start_time", "end_time", "type", "status", "guest", "guests", "price_eur"];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.date,
        r.start_time ? String(r.start_time).slice(0, 5) : "",
        r.end_time ? String(r.end_time).slice(0, 5) : "",
        r.reservation_type,
        r.status ?? "",
        r.guest_name,
        guestsOf(r),
        r.price_eur ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\n");
}

export function buildReportHtml(
  businessName: string,
  startDate: string,
  rows: ReportRow[],
): string {
  const days = summarizeByDay(startDate, rows);
  const endDate = addDaysIso(startDate, REPORT_DAYS - 1);
  const totalRes = days.reduce((s, d) => s + d.reservations, 0);
  const totalGuests = days.reduce((s, d) => s + d.guests, 0);
  const totalRevenue = Math.round(days.reduce((s, d) => s + d.revenue, 0) * 100) / 100;

  const dayRows = days
    .map(
      (d, i) => `<tr style="background-color:${i % 2 === 0 ? "#faf8f5" : "#ffffff"}">
      <td style="padding:8px 12px;font-family:'Inter',Arial,sans-serif;font-size:13px;color:#1E1519">${escapeHtml(d.date)}</td>
      <td style="padding:8px 12px;font-family:'Inter',Arial,sans-serif;font-size:13px;color:#1E1519">${d.reservations}</td>
      <td style="padding:8px 12px;font-family:'Inter',Arial,sans-serif;font-size:13px;color:#63516E">${d.guests}</td>
      <td style="padding:8px 12px;font-family:'Inter',Arial,sans-serif;font-size:13px;color:#63516E">${d.revenue.toFixed(2)} EUR</td>
    </tr>`,
    )
    .join("");

  const byType = new Map<string, { count: number; guests: number }>();
  for (const r of rows) {
    const entry = byType.get(r.reservation_type) ?? { count: 0, guests: 0 };
    entry.count += 1;
    entry.guests += guestsOf(r);
    byType.set(r.reservation_type, entry);
  }
  const typeRows = Array.from(byType.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map(
      ([type, entry]) =>
        `<tr><td style="padding:6px 12px;font-family:'Inter',Arial,sans-serif;font-size:13px;color:#1E1519">${escapeHtml(type)}</td><td style="padding:6px 12px;font-family:'Inter',Arial,sans-serif;font-size:13px;color:#63516E">${entry.count} / ${entry.guests}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:32px;background:#ffffff;font-family:'Inter',Arial,sans-serif">
  <h1 style="font-family:'Playfair Display',Georgia,serif;color:#1E1519;font-size:22px;margin:0 0 4px">Weekly report</h1>
  <p style="color:#63516E;font-size:14px;margin:0 0 20px">${escapeHtml(businessName)} · ${escapeHtml(startDate)} to ${escapeHtml(endDate)}</p>
  <p style="color:#1E1519;font-size:15px;margin:0 0 16px">
    ${totalRes} reservations, ${totalGuests} guests, ${totalRevenue.toFixed(2)} EUR booked.
  </p>
  <table style="border-collapse:collapse;width:100%;margin-bottom:20px">
    <thead><tr>
      <th align="left" style="padding:8px 12px;font-family:'Inter',Arial,sans-serif;font-size:12px;color:#63516E">Date</th>
      <th align="left" style="padding:8px 12px;font-family:'Inter',Arial,sans-serif;font-size:12px;color:#63516E">Reservations</th>
      <th align="left" style="padding:8px 12px;font-family:'Inter',Arial,sans-serif;font-size:12px;color:#63516E">Guests</th>
      <th align="left" style="padding:8px 12px;font-family:'Inter',Arial,sans-serif;font-size:12px;color:#63516E">Value</th>
    </tr></thead>
    <tbody>${dayRows}</tbody>
  </table>
  ${typeRows ? `<h2 style="font-family:'Playfair Display',Georgia,serif;color:#1E1519;font-size:17px;margin:0 0 8px">By service (bookings / guests)</h2><table style="border-collapse:collapse;margin-bottom:20px">${typeRows}</table>` : ""}
  <h2 style="font-family:'Playfair Display',Georgia,serif;color:#1E1519;font-size:17px;margin:0 0 8px">CSV</h2>
  <p style="color:#63516E;font-size:12px;margin:0 0 8px">Copy the block below into a spreadsheet.</p>
  <pre style="background:#faf8f5;border:1px solid #eee;border-radius:8px;padding:12px;font-size:11px;color:#1E1519;overflow-x:auto;white-space:pre">${escapeHtml(buildReportCsv(rows))}</pre>
  <p style="color:#999;font-size:12px;margin-top:24px">${escapeHtml(businessName)} · MimmoBook</p>
</body></html>`;
}

type TenantSetting = {
  tenant_id: string;
  business_name: string | null;
  business_email: string | null;
  weekly_report_recipients: string[] | null;
  weekly_report_weekday: number | null;
  timezone: string | null;
};

export async function handleWeeklyOpsReportRequest(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req, { allowMethods: "POST, OPTIONS" });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
  const authHeader = req.headers.get("Authorization");
  const isCron = Boolean(serviceRoleKey) && authHeader === `Bearer ${serviceRoleKey}`;

  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const wantsTestSend = (body as Record<string, unknown>).test === true;

  let staffTenantId: string | null = null;
  if (!isCron) {
    if (!wantsTestSend) return json({ error: "Unauthorized" }, 401);

    const auth = await requireAuth(req, corsHeaders, { caller: "weekly-ops-report" });
    if (auth instanceof Response) return auth;

    const { data: membership } = await auth.adminClient
      .from("tenant_users")
      .select("tenant_id, role, is_approved")
      .eq("user_id", auth.userId)
      .maybeSingle();

    const allowedRoles = ["owner", "admin", "superadmin"];
    if (!membership || membership.is_approved === false || !allowedRoles.includes(String(membership.role))) {
      return json({ error: "Insufficient permissions" }, 403);
    }
    staffTenantId = membership.tenant_id as string;
  }

  try {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const now = new Date();
    const columns =
      "tenant_id, business_name, business_email, weekly_report_recipients, weekly_report_weekday, timezone";

    const query = staffTenantId
      ? admin.from("tenant_settings").select(columns).eq("tenant_id", staffTenantId).limit(1)
      : admin
          .from("tenant_settings")
          .select(columns)
          .eq("weekly_report_enabled", true)
          .limit(MAX_TENANTS_PER_RUN);

    const { data: settings, error: settingsErr } = await query;
    if (settingsErr) {
      console.error("Failed to load weekly report settings", settingsErr.message);
      return json({ error: "Failed to load weekly report settings" }, 500);
    }

    let enqueued = 0;
    let skipped = 0;
    let dueTenants = 0;
    let lastStart: string | null = null;

    for (const setting of (settings ?? []) as TenantSetting[]) {
      const timezone = normalizeTimezone(setting.timezone);

      // Hourly cron, one send: only the tenants whose local clock reads the
      // send hour on their chosen weekday are mailed.
      if (!staffTenantId) {
        const dueToday = tenantLocalWeekday(now, timezone) === normalizeWeekday(setting.weekly_report_weekday);
        if (!dueToday || tenantLocalHour(now, timezone) !== SEND_LOCAL_HOUR) {
          skipped++;
          continue;
        }
      }
      dueTenants++;

      const recipients = normalizeRecipients(setting.weekly_report_recipients, setting.business_email);
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

      const startDate = tenantLocalDate(now, timezone);
      const endDate = addDaysIso(startDate, REPORT_DAYS - 1);
      lastStart = startDate;

      const { data: rows } = await admin
        .from("reservations")
        .select(
          "reservation_type, status, date, start_time, end_time, guest_name, guests_count, estimated_guests, price_eur",
        )
        .eq("tenant_id", setting.tenant_id)
        .neq("status", "cancelled")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true, nullsFirst: false })
        .limit(MAX_ROWS);

      const businessName = setting.business_name || "MimmoBook";
      const html = buildReportHtml(businessName, startDate, (rows ?? []) as ReportRow[]);
      const subjectPrefix = staffTenantId ? "Test weekly report" : "Weekly report";

      for (const to of recipients) {
        const { error: enqueueErr } = await admin.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            to,
            from: `MimmoBook <noreply@${SENDER_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject: `${subjectPrefix} ${startDate} to ${endDate} · ${businessName}`,
            html,
            purpose: "transactional",
            label: staffTenantId ? "weekly_ops_report_test" : "weekly_ops_report",
            tenant_id: setting.tenant_id,
            queued_at: new Date().toISOString(),
          },
        });
        if (enqueueErr) {
          console.error("Failed to enqueue weekly report", enqueueErr.message);
          continue;
        }
        enqueued++;
      }
    }

    if (staffTenantId && enqueued === 0) {
      return json({ error: "No valid recipients configured." }, 400);
    }

    return json({
      success: true,
      start: lastStart,
      enqueued,
      skipped,
      due: dueTenants,
      tenants: settings?.length ?? 0,
    });
  } catch (error) {
    console.error("Weekly ops report error", error);
    return json({ error: "Failed to process weekly ops report" }, 500);
  }
}

Deno.serve(handleWeeklyOpsReportRequest);
