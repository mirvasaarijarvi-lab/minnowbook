import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

function buildEmailHtml(reservation: any, business: any, lang: string, customBody?: string): string {
  const t = getT(lang);
  const primaryColor = business.primary_color || "#1e3a5f";
  const accentColor = business.accent_color || "#d4a853";
  const businessName = business.business_name || "Business";

  const rows: { label: string; value: string }[] = [];
  rows.push({ label: t.type, value: reservation.reservation_type });
  rows.push({
    label: t.date,
    value:
      reservation.date +
      (reservation.start_time
        ? ` ${t.at} ${reservation.start_time.slice(0, 5)}`
        : ""),
  });
  if (reservation.check_out_date)
    rows.push({ label: t.checkOut, value: reservation.check_out_date });
  if (reservation.room_type)
    rows.push({ label: t.roomType, value: reservation.room_type });
  if (reservation.event_type)
    rows.push({ label: t.eventType, value: reservation.event_type });
  if (reservation.guests_count)
    rows.push({ label: t.guests, value: String(reservation.guests_count) });
  if (reservation.price_eur != null)
    rows.push({
      label: t.price,
      value: `€${Number(reservation.price_eur).toFixed(2)}`,
    });

  const detailsHtml = rows
    .map(
      (r, i) =>
        `<tr style="background-color:${i % 2 === 0 ? "#f9fafb" : "#ffffff"}">
          <td style="padding:10px 16px;font-weight:600;color:#374151;border-right:1px solid #e5e7eb;width:40%">${r.label}</td>
          <td style="padding:10px 16px;color:#111827">${r.value}</td>
        </tr>`
    )
    .join("");

  // If there's a custom template body, replace variables and use it
  let bodyContent: string;
  if (customBody) {
    bodyContent = customBody
      .replace(/\{\{guest_name\}\}/g, reservation.guest_name)
      .replace(/\{\{guest_email\}\}/g, reservation.guest_email)
      .replace(/\{\{date\}\}/g, reservation.date)
      .replace(/\{\{start_time\}\}/g, reservation.start_time?.slice(0, 5) || "")
      .replace(/\{\{reservation_type\}\}/g, reservation.reservation_type)
      .replace(/\{\{guests_count\}\}/g, String(reservation.guests_count || ""))
      .replace(/\{\{price_eur\}\}/g, reservation.price_eur != null ? Number(reservation.price_eur).toFixed(2) : "")
      .replace(/\{\{business_name\}\}/g, businessName);
  } else {
    bodyContent = `
      <p style="color:#4b5563;font-size:14px">${t.greeting} <strong>${reservation.guest_name}</strong>,</p>
      <p style="color:#4b5563;font-size:14px">${t.body}</p>`;
  }

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
          ${bodyContent}
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin:16px 0;font-size:14px">
            ${detailsHtml}
          </table>
          ${!customBody ? `<p style="color:#4b5563;font-size:14px">${t.footer}</p>` : ""}
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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured. Skipping." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Find reservations happening in the next 20–28 hours that haven't been reminded yet
    // and are confirmed (not cancelled/pending)
    const now = new Date();
    const from20h = new Date(now.getTime() + 20 * 60 * 60 * 1000);
    const to28h = new Date(now.getTime() + 28 * 60 * 60 * 1000);

    const fromDate = from20h.toISOString().slice(0, 10);
    const toDate = to28h.toISOString().slice(0, 10);

    const { data: reservations, error: fetchErr } = await adminClient
      .from("reservations")
      .select("*, tenants!inner(name, is_active)")
      .is("reminder_email_sent_at", null)
      .eq("status", "confirmed")
      .gte("date", fromDate)
      .lte("date", toDate)
      .limit(100);

    if (fetchErr) {
      console.error("Error fetching reservations:", fetchErr);
      throw new Error("Failed to fetch upcoming reservations");
    }

    if (!reservations || reservations.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No reservations need reminders" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Gather unique tenant IDs to fetch settings and custom templates
    const tenantIds = [...new Set(reservations.map((r: any) => r.tenant_id))];

    // Fetch tenant settings for branding
    const { data: allSettings } = await adminClient
      .from("tenant_settings")
      .select("*")
      .in("tenant_id", tenantIds);

    const settingsMap = new Map<string, any>();
    (allSettings || []).forEach((s: any) => settingsMap.set(s.tenant_id, s));

    // Fetch custom reminder templates
    const { data: customTemplates } = await adminClient
      .from("tenant_email_templates")
      .select("*")
      .in("tenant_id", tenantIds)
      .eq("template_type", "reminder")
      .eq("is_active", true)
      .is("site_id", null);

    const templateMap = new Map<string, any[]>();
    (customTemplates || []).forEach((tmpl: any) => {
      const list = templateMap.get(tmpl.tenant_id) || [];
      list.push(tmpl);
      templateMap.set(tmpl.tenant_id, list);
    });

    let sentCount = 0;
    let errorCount = 0;

    for (const reservation of reservations) {
      try {
        if (!reservation.guest_email) continue;

        const settings = settingsMap.get(reservation.tenant_id);
        const tenantName = (reservation as any).tenants?.name || "";

        const business = {
          business_name: settings?.business_name || tenantName,
          business_email: settings?.business_email || "",
          business_phone: settings?.business_phone || "",
          business_address: settings?.business_address || "",
          primary_color: settings?.primary_color || "#1e3a5f",
          accent_color: settings?.accent_color || "#d4a853",
          logo_url: settings?.logo_url || "",
        };

        const lang = reservation.language || settings?.default_language || "en";
        const t = getT(lang);

        // Check for custom template
        const templates = templateMap.get(reservation.tenant_id) || [];
        const customTemplate =
          templates.find((tmpl: any) => tmpl.language === lang) ||
          templates.find((tmpl: any) => tmpl.language === "en") ||
          templates[0];

        let subject = `${t.subject} — ${business.business_name}`;
        let customBody: string | undefined;

        if (customTemplate) {
          subject = customTemplate.subject
            .replace(/\{\{guest_name\}\}/g, reservation.guest_name)
            .replace(/\{\{date\}\}/g, reservation.date)
            .replace(/\{\{business_name\}\}/g, business.business_name);
          customBody = customTemplate.body_html;
        }

        const html = buildEmailHtml(reservation, business, lang, customBody);
        const fromEmail = business.business_email || "noreply@example.com";
        const fromName = business.business_name || "Reservations";

        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: `${fromName} <${fromEmail}>`,
            to: [reservation.guest_email],
            subject,
            html,
          }),
        });

        if (!resendResponse.ok) {
          const errorBody = await resendResponse.text();
          console.error(`Resend error for ${reservation.id}:`, errorBody);
          errorCount++;
          continue;
        }

        // Mark reminder as sent
        await adminClient
          .from("reservations")
          .update({ reminder_email_sent_at: new Date().toISOString() })
          .eq("id", reservation.id);

        sentCount++;
      } catch (err) {
        console.error(`Error sending reminder for ${reservation.id}:`, err);
        errorCount++;
      }
    }

    console.log(`Auto-reminders complete: ${sentCount} sent, ${errorCount} errors out of ${reservations.length} eligible`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, errors: errorCount, total: reservations.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Auto-reminder error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to process auto-reminders" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
