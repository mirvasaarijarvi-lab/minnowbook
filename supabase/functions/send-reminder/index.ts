import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- CORS with origin allowlist ---
const ALLOWED_ORIGINS = [
  "https://minnowbook.lovable.app",
  /^https:\/\/.*\.lovable\.app$/,
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.some((o) =>
    typeof o === "string" ? o === origin : o.test(origin)
  );
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0] as string,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cache-Control": "no-store, no-cache, must-revalidate",
  };
}


const SENDER_DOMAIN = "notify.mimmobook.com";

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

// --- Translations per email type ---
const translations: Record<string, Record<string, Record<string, string>>> = {
  acknowledgment: {
    en: {
      subject: "We received your booking request",
      title: "Booking Received",
      greeting: "Dear",
      body: "Thank you for your booking request. We will review it and get back to you shortly.",
      footer: "You will receive a confirmation email once your booking is approved. If you have questions, please contact us.",
      icon: "📩",
    },
    fi: {
      subject: "Olemme vastaanottaneet varauspyyntösi",
      title: "Varaus vastaanotettu",
      greeting: "Hyvä",
      body: "Kiitos varauspyynnöstäsi. Käsittelemme sen ja palaamme asiaan pian.",
      footer: "Saat vahvistusviestin, kun varauksesi on hyväksytty. Ota yhteyttä, jos sinulla on kysyttävää.",
      icon: "📩",
    },
    sv: {
      subject: "Vi har mottagit din bokningsförfrågan",
      title: "Bokning mottagen",
      greeting: "Kära",
      body: "Tack för din bokningsförfrågan. Vi kommer att granska den och återkomma inom kort.",
      footer: "Du får ett bekräftelsemeddelande när din bokning har godkänts. Kontakta oss om du har frågor.",
      icon: "📩",
    },
  },
  confirmation: {
    en: {
      subject: "Your reservation has been confirmed",
      title: "Reservation Confirmed",
      greeting: "Dear",
      body: "Great news! Your reservation has been confirmed. Here are the details:",
      footer: "We look forward to welcoming you! If you need to make any changes, please contact us.",
      icon: "✅",
    },
    fi: {
      subject: "Varauksesi on vahvistettu",
      title: "Varaus vahvistettu",
      greeting: "Hyvä",
      body: "Hienoa! Varauksesi on vahvistettu. Tässä ovat tiedot:",
      footer: "Toivotamme sinut tervetulleeksi! Jos sinun tarvitsee tehdä muutoksia, ota meihin yhteyttä.",
      icon: "✅",
    },
    sv: {
      subject: "Din bokning har bekräftats",
      title: "Bokning bekräftad",
      greeting: "Kära",
      body: "Goda nyheter! Din bokning har bekräftats. Här är detaljerna:",
      footer: "Vi ser fram emot att välkomna dig! Kontakta oss om du behöver göra ändringar.",
      icon: "✅",
    },
  },
  reminder: {
    en: {
      subject: "Reminder: Your upcoming reservation",
      title: "Reservation Reminder",
      greeting: "Dear",
      body: "This is a friendly reminder about your upcoming reservation. Here are the details:",
      footer: "If you need to make any changes, please contact us. We look forward to seeing you!",
      icon: "🔔",
    },
    fi: {
      subject: "Muistutus: Tuleva varauksesi",
      title: "Varausmuistutus",
      greeting: "Hyvä",
      body: "Tämä on ystävällinen muistutus tulevasta varauksestasi. Tässä ovat tiedot:",
      footer: "Jos sinun tarvitsee tehdä muutoksia, ota meihin yhteyttä. Odotamme innolla vierailuasi!",
      icon: "🔔",
    },
    sv: {
      subject: "Påminnelse: Din kommande bokning",
      title: "Bokningspåminnelse",
      greeting: "Kära",
      body: "Detta är en vänlig påminnelse om din kommande bokning. Här är detaljerna:",
      footer: "Om du behöver göra ändringar, kontakta oss. Vi ser fram emot att välkomna dig!",
      icon: "🔔",
    },
  },
  cancellation: {
    en: {
      subject: "Your reservation has been cancelled",
      title: "Reservation Cancelled",
      greeting: "Dear",
      body: "We regret to inform you that your reservation has been cancelled. Here were the details:",
      footer: "If you have any questions or would like to rebook, please don't hesitate to contact us.",
      icon: "❌",
    },
    fi: {
      subject: "Varauksesi on peruutettu",
      title: "Varaus peruutettu",
      greeting: "Hyvä",
      body: "Ilmoitamme, että varauksesi on peruutettu. Tässä olivat tiedot:",
      footer: "Jos sinulla on kysyttävää tai haluat varata uudelleen, ota meihin yhteyttä.",
      icon: "❌",
    },
    sv: {
      subject: "Din bokning har avbokats",
      title: "Bokning avbokad",
      greeting: "Kära",
      body: "Vi beklagar att meddela att din bokning har avbokats. Här var detaljerna:",
      footer: "Kontakta oss om du har frågor eller vill boka om.",
      icon: "❌",
    },
  },
};

const detailLabels: Record<string, Record<string, string>> = {
  en: { type: "Type", date: "Date", time: "Time", guests: "Guests", checkOut: "Check-out", roomType: "Room type", eventType: "Event type", price: "Price", at: "at" },
  fi: { type: "Tyyppi", date: "Päivämäärä", time: "Aika", guests: "Vieraat", checkOut: "Uloskirjautuminen", roomType: "Huonetyyppi", eventType: "Tapahtumatyyppi", price: "Hinta", at: "klo" },
  sv: { type: "Typ", date: "Datum", time: "Tid", guests: "Gäster", checkOut: "Utcheckning", roomType: "Rumstyp", eventType: "Evenemangstyp", price: "Pris", at: "kl" },
};

function getT(emailType: string, lang: string) {
  return translations[emailType]?.[lang] || translations[emailType]?.en || translations.reminder.en;
}

function getDL(lang: string) {
  return detailLabels[lang] || detailLabels.en;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function replaceVars(text: string, reservation: any, businessName: string): string {
  return text
    .replace(/\{\{guest_name\}\}/g, escapeHtml(reservation.guest_name || ""))
    .replace(/\{\{guest_email\}\}/g, escapeHtml(reservation.guest_email || ""))
    .replace(/\{\{date\}\}/g, escapeHtml(reservation.date || ""))
    .replace(/\{\{start_time\}\}/g, escapeHtml(reservation.start_time?.slice(0, 5) || ""))
    .replace(/\{\{reservation_type\}\}/g, escapeHtml(reservation.reservation_type || ""))
    .replace(/\{\{guests_count\}\}/g, escapeHtml(String(reservation.guests_count || "")))
    .replace(/\{\{price_eur\}\}/g, escapeHtml(reservation.price_eur != null ? Number(reservation.price_eur).toFixed(2) : ""))
    .replace(/\{\{business_name\}\}/g, escapeHtml(businessName));
}

function buildEmailHtml(reservation: any, business: any, lang: string, emailType: string, customBody?: string, customMessage?: string): string {
  const t = getT(emailType, lang);
  const dl = getDL(lang);
  const primaryColor = business.primary_color || "#3F1F5C";
  const businessName = business.business_name || "Business";
  const logoUrl = business.logo_url || "https://lsgznskkxadplwnxplhd.supabase.co/storage/v1/object/public/tenant-assets/email-assets%2Flogo-color.png";

  const rows: { label: string; value: string }[] = [];
  rows.push({ label: dl.type, value: reservation.reservation_type });
  rows.push({ label: dl.date, value: reservation.date + (reservation.start_time ? ` ${dl.at} ${reservation.start_time.slice(0, 5)}` : "") });
  if (reservation.check_out_date) rows.push({ label: dl.checkOut, value: reservation.check_out_date });
  if (reservation.room_type) rows.push({ label: dl.roomType, value: reservation.room_type });
  if (reservation.event_type) rows.push({ label: dl.eventType, value: reservation.event_type });
  if (reservation.guests_count) rows.push({ label: dl.guests, value: String(reservation.guests_count) });
  if (reservation.price_eur != null) rows.push({ label: dl.price, value: `€${Number(reservation.price_eur).toFixed(2)}` });

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
    bodyContent = replaceVars(customBody, reservation, businessName);
  } else {
    bodyContent = `
      <p style="color:#63516E;font-size:15px;font-family:'Inter',Arial,sans-serif;line-height:1.6">${t.greeting} <strong style="color:#1E1519">${reservation.guest_name}</strong>,</p>
      <p style="color:#63516E;font-size:15px;font-family:'Inter',Arial,sans-serif;line-height:1.6">${t.body}</p>`;
  }

  const customMsgHtml = customMessage
    ? `<div style="margin:16px 0;padding:12px 16px;background-color:#f5f0fa;border-left:4px solid ${escapeHtml(primaryColor)};border-radius:4px;font-size:14px;color:#3F1F5C;font-family:'Inter',Arial,sans-serif">${escapeHtml(customMessage)}</div>`
    : "";

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
            <div style="display:inline-block;width:48px;height:48px;line-height:48px;border-radius:50%;background-color:#f5f0fa;font-size:24px;text-align:center">${t.icon}</div>
            <h1 style="color:#1E1519;font-size:24px;font-family:'Playfair Display',Georgia,serif;font-weight:700;margin:12px 0 0">${t.title}</h1>
          </div>
          ${bodyContent}
          ${customMsgHtml}
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

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
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
    // Reject oversized request bodies (50KB max)
    const MAX_BODY_SIZE = 50 * 1024;
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    if (contentLength > MAX_BODY_SIZE) {
      return new Response(JSON.stringify({ error: "Request too large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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
    const emailType: string = body.emailType || "reminder";
    const customMessage: string | undefined = body.customMessage;

    if (!reservationId || typeof reservationId !== "string") throw new Error("reservationId is required");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reservationId)) {
      throw new Error("Invalid reservationId format");
    }
    if (!["acknowledgment", "confirmation", "reminder", "cancellation"].includes(emailType)) {
      throw new Error("Invalid emailType. Must be acknowledgment, confirmation, reminder, or cancellation.");
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

    const { data: tenantRow } = await adminClient
      .from("tenants")
      .select("name")
      .eq("id", tenantId)
      .single();

    const business = {
      business_name: settings?.business_name || tenantRow?.name || "",
      business_email: settings?.business_email || "",
      business_phone: settings?.business_phone || "",
      business_address: settings?.business_address || "",
      primary_color: settings?.primary_color || "#3F1F5C",
      accent_color: settings?.accent_color || "#FF5733",
      logo_url: settings?.logo_url || "",
    };

    const lang = reservation.language || settings?.default_language || "en";
    const t = getT(emailType, lang);

    // Check for custom template
    let customTemplate: any = null;

    if (reservation.site_id) {
      const { data: siteTemplates } = await adminClient
        .from("tenant_email_templates")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("template_type", emailType)
        .eq("is_active", true)
        .eq("site_id", reservation.site_id);

      customTemplate =
        siteTemplates?.find((tmpl: any) => tmpl.language === lang) ||
        siteTemplates?.find((tmpl: any) => tmpl.language === "en") ||
        siteTemplates?.[0] || null;
    }

    if (!customTemplate) {
      const { data: tenantTemplates } = await adminClient
        .from("tenant_email_templates")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("template_type", emailType)
        .eq("is_active", true)
        .is("site_id", null);

      customTemplate =
        tenantTemplates?.find((tmpl: any) => tmpl.language === lang) ||
        tenantTemplates?.find((tmpl: any) => tmpl.language === "en") ||
        tenantTemplates?.[0] || null;
    }

    let subject: string;
    let customBody: string | undefined;

    if (customTemplate) {
      subject = replaceVars(customTemplate.subject, reservation, business.business_name);
      customBody = customTemplate.body_html;
    } else {
      subject = `${t.subject} — ${business.business_name}`;
    }

    const html = buildEmailHtml(reservation, business, lang, emailType, customBody, customMessage);
    const fromName = business.business_name || "Mimmobook";

    // Determine reply-to: site-level business_email overrides tenant-level
    let replyToEmail = business.business_email || undefined;
    if (reservation.site_id) {
      const { data: siteSettings } = await adminClient
        .from("site_settings")
        .select("business_email")
        .eq("site_id", reservation.site_id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (siteSettings?.business_email) {
        replyToEmail = siteSettings.business_email;
      }
    }

    // Enqueue via transactional email queue
    const messageId = `${emailType}-${reservationId}-${Date.now()}@${SENDER_DOMAIN}`;
    const enqueuePayload: Record<string, any> = {
      to: reservation.guest_email,
      from: `${fromName} <noreply@${SENDER_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      purpose: "transactional",
      label: `booking_${emailType}`,
      message_id: messageId,
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
      console.error("Failed to enqueue email:", enqueueError);
      throw new Error("Failed to queue email for sending");
    }

    // Update the appropriate sent_at timestamp
    const timestampField =
      emailType === "acknowledgment" ? "acknowledgment_email_sent_at" :
      emailType === "confirmation" ? "confirmation_email_sent_at" :
      emailType === "cancellation" ? "cancellation_email_sent_at" :
      "reminder_email_sent_at";

    await adminClient
      .from("reservations")
      .update({ [timestampField]: new Date().toISOString() })
      .eq("id", reservationId)
      .eq("tenant_id", tenantId);

    return new Response(JSON.stringify({ success: true, emailType }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Failed to send email" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
