import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/http-headers.ts";

const SENDER_DOMAIN = "notify.mimmobook.com";

// --- Translations ---
const translations: Record<string, Record<string, string>> = {
  en: {
    subject: "Reminder: Your upcoming reservation",
    title: "Reservation Reminder",
    greeting: "Dear",
    body: "This is a friendly reminder about your upcoming reservation. Here are the details:",
    footer: "If you need to make any changes, please contact us. We look forward to seeing you!",
    type: "Type", date: "Date", time: "Time", guests: "Guests", checkOut: "Check-out",
    roomType: "Room type", eventType: "Event type", price: "Price", at: "at",
  },
  fi: {
    subject: "Muistutus: Tuleva varauksesi",
    title: "Varausmuistutus",
    greeting: "Hyvä",
    body: "Tämä on ystävällinen muistutus tulevasta varauksestasi. Tässä ovat tiedot:",
    footer: "Jos sinun tarvitsee tehdä muutoksia, ota meihin yhteyttä. Odotamme innolla vierailuasi!",
    type: "Tyyppi", date: "Päivämäärä", time: "Aika", guests: "Vieraat", checkOut: "Uloskirjautuminen",
    roomType: "Huonetyyppi", eventType: "Tapahtumatyyppi", price: "Hinta", at: "klo",
  },
  sv: {
    subject: "Påminnelse: Din kommande bokning",
    title: "Bokningspåminnelse",
    greeting: "Kära",
    body: "Detta är en vänlig påminnelse om din kommande bokning. Här är detaljerna:",
    footer: "Om du behöver göra ändringar, kontakta oss. Vi ser fram emot att välkomna dig!",
    type: "Typ", date: "Datum", time: "Tid", guests: "Gäster", checkOut: "Utcheckning",
    roomType: "Rumstyp", eventType: "Evenemangstyp", price: "Pris", at: "kl",
  },
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getT(lang: string) {
  return translations[lang] || translations.en;
}

function buildEmailHtml(reservation: any, business: any, lang: string, customBody?: string): string {
  const t = getT(lang);
  const primaryColor = business.primary_color || "#3F1F5C";
  const businessName = business.business_name || "Business";
  const logoUrl = business.logo_url || "https://lsgznskkxadplwnxplhd.supabase.co/storage/v1/object/public/tenant-assets/email-assets%2Flogo-color.png";

  const rows: { label: string; value: string }[] = [];
  rows.push({ label: t.type, value: escapeHtml(reservation.reservation_type) });
  rows.push({ label: t.date, value: escapeHtml(reservation.date + (reservation.start_time ? ` ${t.at} ${reservation.start_time.slice(0, 5)}` : "")) });
  if (reservation.check_out_date) rows.push({ label: t.checkOut, value: escapeHtml(reservation.check_out_date) });
  if (reservation.room_type) rows.push({ label: t.roomType, value: escapeHtml(reservation.room_type) });
  if (reservation.event_type) rows.push({ label: t.eventType, value: escapeHtml(reservation.event_type) });
  if (reservation.guests_count) rows.push({ label: t.guests, value: String(reservation.guests_count) });
  if (reservation.price_eur != null) rows.push({ label: t.price, value: `€${Number(reservation.price_eur).toFixed(2)}` });

  const detailsHtml = rows
    .map(
      (r, i) =>
        `<tr style="background-color:${i % 2 === 0 ? "#faf8f5" : "#ffffff"}">
          <td style="padding:10px 16px;font-weight:600;color:#1E1519;border-right:1px solid #e8e0d8;width:40%;font-family:'Inter',Arial,sans-serif;font-size:14px">${r.label}</td>
          <td style="padding:10px 16px;color:#63516E;font-family:'Inter',Arial,sans-serif;font-size:14px">${r.value}</td>
        </tr>`
    )
    .join("");

  let bodyContent: string;
  if (customBody) {
    bodyContent = customBody
      .replace(/\{\{guest_name\}\}/g, escapeHtml(reservation.guest_name))
      .replace(/\{\{guest_email\}\}/g, escapeHtml(reservation.guest_email))
      .replace(/\{\{date\}\}/g, escapeHtml(reservation.date))
      .replace(/\{\{start_time\}\}/g, escapeHtml(reservation.start_time?.slice(0, 5) || ""))
      .replace(/\{\{reservation_type\}\}/g, escapeHtml(reservation.reservation_type))
      .replace(/\{\{guests_count\}\}/g, escapeHtml(String(reservation.guests_count || "")))
      .replace(/\{\{price_eur\}\}/g, escapeHtml(reservation.price_eur != null ? Number(reservation.price_eur).toFixed(2) : ""))
      .replace(/\{\{business_name\}\}/g, escapeHtml(businessName));
  } else {
    bodyContent = `
      <p style="color:#63516E;font-size:15px;font-family:'Inter',Arial,sans-serif;line-height:1.6">${t.greeting} <strong style="color:#1E1519">${escapeHtml(reservation.guest_name)}</strong>,</p>
      <p style="color:#63516E;font-size:15px;font-family:'Inter',Arial,sans-serif;line-height:1.6">${t.body}</p>`;
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;padding:32px 0">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff">
        <tr><td style="text-align:center;padding:32px 32px 24px">
          <img src="${logoUrl}" alt="${businessName}" style="height:48px;width:auto;margin-bottom:24px">
        </td></tr>
        <tr><td style="padding:0 32px 32px">
          <div style="text-align:center;margin-bottom:24px">
            <div style="display:inline-block;width:48px;height:48px;line-height:48px;border-radius:50%;background-color:#f5f0fa;font-size:24px;text-align:center">🔔</div>
            <h1 style="color:#1E1519;font-size:24px;font-family:'Playfair Display',Georgia,serif;font-weight:700;margin:12px 0 0">${t.title}</h1>
          </div>
          ${bodyContent}
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e0d8;border-radius:10px;overflow:hidden;margin:20px 0;font-size:14px">
            ${detailsHtml}
          </table>
          ${!customBody ? `<p style="color:#63516E;font-size:14px;font-family:'Inter',Arial,sans-serif;line-height:1.6">${t.footer}</p>` : ""}
        </td></tr>
        <tr><td style="padding:24px 32px;text-align:center;font-size:12px;color:#999;border-top:1px solid #e8e0d8;font-family:'Inter',Arial,sans-serif">
          <p style="margin:4px 0;font-weight:600;color:#63516E">${businessName}</p>
          ${business.business_address ? `<p style="margin:4px 0">${business.business_address}</p>` : ""}
          ${business.business_phone ? `<p style="margin:4px 0">${business.business_phone}</p>` : ""}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function handleSendAutoRemindersRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Find reservations happening in the next 20-28 hours that haven't been reminded yet
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
        JSON.stringify({ success: true, enqueued: 0, message: "No reservations need reminders" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantIds = [...new Set(reservations.map((r: any) => r.tenant_id))];

    const { data: allSettings } = await adminClient
      .from("tenant_settings")
      .select("*")
      .in("tenant_id", tenantIds);

    const settingsMap = new Map<string, any>();
    (allSettings || []).forEach((s: any) => settingsMap.set(s.tenant_id, s));

    const { data: customTemplates } = await adminClient
      .from("tenant_email_templates")
      .select("*")
      .in("tenant_id", tenantIds)
      .eq("template_type", "reminder")
      .eq("is_active", true);

    const siteTemplateMap = new Map<string, any[]>();
    const templateMap = new Map<string, any[]>();
    (customTemplates || []).forEach((tmpl: any) => {
      if (tmpl.site_id) {
        const key = `${tmpl.tenant_id}:${tmpl.site_id}`;
        const list = siteTemplateMap.get(key) || [];
        list.push(tmpl);
        siteTemplateMap.set(key, list);
      } else {
        const list = templateMap.get(tmpl.tenant_id) || [];
        list.push(tmpl);
        templateMap.set(tmpl.tenant_id, list);
      }
    });

    let enqueuedCount = 0;
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
          primary_color: settings?.primary_color || "#3F1F5C",
          accent_color: settings?.accent_color || "#FF5733",
          logo_url: settings?.logo_url || "",
        };

        const lang = reservation.language || settings?.default_language || "en";
        const t = getT(lang);

        let customTemplate: any = null;
        if (reservation.site_id) {
          const siteKey = `${reservation.tenant_id}:${reservation.site_id}`;
          const siteTemplates = siteTemplateMap.get(siteKey) || [];
          customTemplate =
            siteTemplates.find((tmpl: any) => tmpl.language === lang) ||
            siteTemplates.find((tmpl: any) => tmpl.language === "en") ||
            siteTemplates[0] || null;
        }
        if (!customTemplate) {
          const tenantTemplates = templateMap.get(reservation.tenant_id) || [];
          customTemplate =
            tenantTemplates.find((tmpl: any) => tmpl.language === lang) ||
            tenantTemplates.find((tmpl: any) => tmpl.language === "en") ||
            tenantTemplates[0] || null;
        }

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
        const fromName = business.business_name || "Mimmobook";

        // Determine reply-to: site-level overrides tenant-level
        let replyToEmail = business.business_email || undefined;
        if (reservation.site_id) {
          const { data: siteSettings } = await adminClient
            .from("site_settings")
            .select("business_email")
            .eq("site_id", reservation.site_id)
            .eq("tenant_id", reservation.tenant_id)
            .maybeSingle();
          if (siteSettings?.business_email) {
            replyToEmail = siteSettings.business_email;
          }
        }

        // Enqueue via transactional email queue
        // Generate or reuse unsubscribe token
        const autoUnsubToken = crypto.randomUUID();
        await adminClient
          .from("email_unsubscribe_tokens")
          .upsert({ email: reservation.guest_email, token: autoUnsubToken }, { onConflict: "email", ignoreDuplicates: true });
        const { data: autoTokenRow } = await adminClient
          .from("email_unsubscribe_tokens")
          .select("token")
          .eq("email", reservation.guest_email)
          .maybeSingle();

        const autoIdempotencyKey = `reminder-${reservation.id}`;
        const enqueuePayload: Record<string, any> = {
          to: reservation.guest_email,
          from: `${fromName} <noreply@${SENDER_DOMAIN}>`,
          sender_domain: SENDER_DOMAIN,
          subject,
          html,
          purpose: "transactional",
          label: "booking_reminder",
          message_id: autoIdempotencyKey,
          idempotency_key: autoIdempotencyKey,
          unsubscribe_token: autoTokenRow?.token || autoUnsubToken,
          queued_at: new Date().toISOString(),
        };
        if (replyToEmail) {
          enqueuePayload.reply_to = replyToEmail;
        }

        const { error: enqueueError } = await adminClient.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: enqueuePayload,
        });

        if (enqueueError) {
          console.error(`Failed to enqueue reminder for ${reservation.id}:`, enqueueError);
          errorCount++;
          continue;
        }

        // Mark reminder as sent
        await adminClient
          .from("reservations")
          .update({ reminder_email_sent_at: new Date().toISOString() })
          .eq("id", reservation.id);

        enqueuedCount++;
      } catch (err) {
        console.error(`Error enqueuing reminder for ${reservation.id}:`, err);
        errorCount++;
      }
    }

    console.log(`Auto-reminders complete: ${enqueuedCount} enqueued, ${errorCount} errors out of ${reservations.length} eligible`);

    return new Response(
      JSON.stringify({ success: true, enqueued: enqueuedCount, errors: errorCount, total: reservations.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Auto-reminder error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process auto-reminders" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
Deno.serve(handleSendAutoRemindersRequest);
