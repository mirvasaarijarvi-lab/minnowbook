import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

// --- Rate limiting ---
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
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

// --- Translations ---
const translations: Record<string, Record<string, string>> = {
  en: {
    subject: "Reminder: Your upcoming reservation",
    title: "Reservation Reminder",
    greeting: "Dear",
    body: "This is a friendly reminder about your upcoming reservation. Here are the details:",
    footer: "If you need to make any changes, please contact us. We look forward to seeing you!",
    type: "Type",
    date: "Date",
    time: "Time",
    guests: "Guests",
    checkOut: "Check-out",
    roomType: "Room type",
    eventType: "Event type",
    price: "Price",
    at: "at",
  },
  fi: {
    subject: "Muistutus: Tuleva varauksesi",
    title: "Varausmuistutus",
    greeting: "Hyvä",
    body: "Tämä on ystävällinen muistutus tulevasta varauksestasi. Tässä ovat tiedot:",
    footer: "Jos sinun tarvitsee tehdä muutoksia, ota meihin yhteyttä. Odotamme innolla vierailuasi!",
    type: "Tyyppi",
    date: "Päivämäärä",
    time: "Aika",
    guests: "Vieraat",
    checkOut: "Uloskirjautuminen",
    roomType: "Huonetyyppi",
    eventType: "Tapahtumatyyppi",
    price: "Hinta",
    at: "klo",
  },
  sv: {
    subject: "Påminnelse: Din kommande bokning",
    title: "Bokningspåminnelse",
    greeting: "Kära",
    body: "Detta är en vänlig påminnelse om din kommande bokning. Här är detaljerna:",
    footer: "Om du behöver göra ändringar, kontakta oss. Vi ser fram emot att välkomna dig!",
    type: "Typ",
    date: "Datum",
    time: "Tid",
    guests: "Gäster",
    checkOut: "Utcheckning",
    roomType: "Rumstyp",
    eventType: "Evenemangstyp",
    price: "Pris",
    at: "kl",
  },
};

function getT(lang: string) {
  return translations[lang] || translations.en;
}

function buildEmailHtml(reservation: any, business: any, lang: string): string {
  const t = getT(lang);
  const primaryColor = business.primary_color || "#1e3a5f";
  const accentColor = business.accent_color || "#d4a853";
  const businessName = business.business_name || "Business";

  const rows: { label: string; value: string }[] = [];
  rows.push({ label: t.type, value: reservation.reservation_type });
  rows.push({ label: t.date, value: reservation.date + (reservation.start_time ? ` ${t.at} ${reservation.start_time.slice(0, 5)}` : "") });
  if (reservation.check_out_date) rows.push({ label: t.checkOut, value: reservation.check_out_date });
  if (reservation.room_type) rows.push({ label: t.roomType, value: reservation.room_type });
  if (reservation.event_type) rows.push({ label: t.eventType, value: reservation.event_type });
  if (reservation.guests_count) rows.push({ label: t.guests, value: String(reservation.guests_count) });
  if (reservation.price_eur != null) rows.push({ label: t.price, value: `€${Number(reservation.price_eur).toFixed(2)}` });

  const detailsHtml = rows
    .map(
      (r, i) =>
        `<tr style="background-color:${i % 2 === 0 ? "#f9fafb" : "#ffffff"}">
          <td style="padding:10px 16px;font-weight:600;color:#374151;border-right:1px solid #e5e7eb;width:40%">${r.label}</td>
          <td style="padding:10px 16px;color:#111827">${r.value}</td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
        <tr><td style="background-color:${primaryColor};padding:24px;text-align:center">
          ${business.logo_url ? `<img src="${business.logo_url}" alt="" style="height:40px;width:40px;border-radius:50%;border:2px solid rgba(255,255,255,0.3);margin-bottom:8px">` : ""}
          <h2 style="margin:0;color:#ffffff;font-size:18px;font-family:Georgia,serif">${businessName}</h2>
        </td></tr>
        <tr><td style="padding:32px">
          <div style="text-align:center;margin-bottom:24px">
            <div style="display:inline-block;width:48px;height:48px;line-height:48px;border-radius:50%;background-color:${accentColor}20;font-size:24px;text-align:center">🔔</div>
            <h3 style="color:${primaryColor};font-size:20px;font-family:Georgia,serif;margin:12px 0 0">${t.title}</h3>
          </div>
          <p style="color:#4b5563;font-size:14px">${t.greeting} <strong>${reservation.guest_name}</strong>,</p>
          <p style="color:#4b5563;font-size:14px">${t.body}</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin:16px 0;font-size:14px">
            ${detailsHtml}
          </table>
          <p style="color:#4b5563;font-size:14px">${t.footer}</p>
        </td></tr>
        <tr><td style="background-color:#f9fafb;padding:16px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb">
          <p style="margin:4px 0;font-weight:600">${businessName}</p>
          ${business.business_address ? `<p style="margin:4px 0">${business.business_address}</p>` : ""}
          ${business.business_phone ? `<p style="margin:4px 0">${business.business_phone}</p>` : ""}
          ${business.business_email ? `<p style="margin:4px 0">${business.business_email}</p>` : ""}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
  if (!checkRateLimit(clientIp)) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      throw new Error("Email service not configured. Please add RESEND_API_KEY.");
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: callingUser }, error: authError } = await userClient.auth.getUser();
    if (authError || !callingUser) throw new Error("Not authenticated");

    // Verify caller has tenant membership
    const { data: callerRole } = await adminClient
      .from("tenant_users")
      .select("role, tenant_id")
      .eq("user_id", callingUser.id)
      .single();

    const { data: sysAdmin } = await adminClient
      .from("system_admins")
      .select("id")
      .eq("user_id", callingUser.id)
      .maybeSingle();

    if (!callerRole && !sysAdmin) throw new Error("Insufficient permissions");

    const body = await req.json();
    const reservationId = body.reservationId;
    if (!reservationId || typeof reservationId !== "string") throw new Error("reservationId is required");

    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reservationId)) {
      throw new Error("Invalid reservationId format");
    }

    const tenantId = (sysAdmin && body.tenantId) ? body.tenantId : callerRole?.tenant_id;
    if (!tenantId) throw new Error("No tenant context");

    // Get reservation
    const { data: reservation, error: resErr } = await adminClient
      .from("reservations")
      .select("*")
      .eq("id", reservationId)
      .eq("tenant_id", tenantId)
      .single();
    if (resErr || !reservation) throw new Error("Reservation not found");

    // Get tenant settings for branding
    const { data: settings } = await adminClient
      .from("tenant_settings")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const { data: tenant } = await adminClient
      .from("tenants")
      .select("name")
      .eq("id", tenantId)
      .single();

    const business = {
      business_name: settings?.business_name || tenant?.name || "",
      business_email: settings?.business_email || "",
      business_phone: settings?.business_phone || "",
      business_address: settings?.business_address || "",
      primary_color: settings?.primary_color || "#1e3a5f",
      accent_color: settings?.accent_color || "#d4a853",
      logo_url: settings?.logo_url || "",
    };

    const lang = reservation.language || "en";
    const t = getT(lang);
    const html = buildEmailHtml(reservation, business, lang);
    const fromEmail = business.business_email || "noreply@example.com";
    const fromName = business.business_name || "Reservations";

    // Send via Resend
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [reservation.guest_email],
        subject: `${t.subject} — ${business.business_name}`,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const errorBody = await resendResponse.text();
      console.error("Resend error:", errorBody);
      throw new Error("Failed to send reminder email");
    }

    // Update reminder_email_sent_at
    await adminClient
      .from("reservations")
      .update({ reminder_email_sent_at: new Date().toISOString() })
      .eq("id", reservationId)
      .eq("tenant_id", tenantId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Failed to send reminder" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
