import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function escapeICalText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function formatICalDate(dateStr: string, timeStr?: string | null): string {
  const d = dateStr.replace(/-/g, "");
  if (timeStr) {
    const t = timeStr.replace(/:/g, "").substring(0, 6);
    return `${d}T${t}`;
  }
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const tenantSlug = url.searchParams.get("tenant");
    const siteSlug = url.searchParams.get("site");

    if (!tenantSlug) {
      return new Response("Missing tenant parameter", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find tenant
    const { data: tenant, error: tenantErr } = await supabase
      .from("tenants")
      .select("id, name")
      .eq("slug", tenantSlug)
      .eq("is_active", true)
      .single();

    if (tenantErr || !tenant) {
      return new Response("Tenant not found", {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    // Fetch upcoming reservations
    const today = new Date().toISOString().split("T")[0];
    let query = supabase
      .from("reservations")
      .select("id, guest_name, reservation_type, date, start_time, end_time, check_out_date, guests_count, estimated_guests, special_requests, status")
      .eq("tenant_id", tenant.id)
      .gte("date", today)
      .in("status", ["pending", "confirmed"])
      .order("date", { ascending: true })
      .limit(500);

    if (siteSlug) {
      const { data: site } = await supabase
        .from("sites")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("slug", siteSlug)
        .single();
      if (site) {
        query = query.eq("site_id", site.id);
      }
    }

    const { data: reservations, error: resErr } = await query;
    if (resErr) throw resErr;

    // Build ICS
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      `PRODID:-//MimmoBook//Reservations//EN`,
      `X-WR-CALNAME:${escapeICalText(tenant.name)} Reservations`,
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];

    for (const r of reservations ?? []) {
      const dtStart = formatICalDate(r.date, r.start_time);
      const dtEnd = r.check_out_date
        ? formatICalDate(r.check_out_date)
        : r.end_time
        ? formatICalDate(r.date, r.end_time)
        : formatICalDate(r.date, r.start_time); // same time if no end

      const guests = r.guests_count || r.estimated_guests || "";
      const summary = `${r.guest_name} (${r.reservation_type})${guests ? ` - ${guests} guests` : ""}`;
      const description = [
        `Status: ${r.status}`,
        r.special_requests ? `Requests: ${r.special_requests}` : "",
      ].filter(Boolean).join("\\n");

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${r.id}@mimmobook`);
      lines.push(`DTSTART:${dtStart}`);
      lines.push(`DTEND:${dtEnd}`);
      lines.push(`SUMMARY:${escapeICalText(summary)}`);
      if (description) lines.push(`DESCRIPTION:${escapeICalText(description)}`);
      lines.push(`STATUS:${r.status === "confirmed" ? "CONFIRMED" : "TENTATIVE"}`);
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");

    return new Response(lines.join("\r\n"), {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${tenantSlug}-reservations.ics"`,
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
