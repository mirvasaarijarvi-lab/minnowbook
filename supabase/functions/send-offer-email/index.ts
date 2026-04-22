const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SENDER_DOMAIN = "notify.mimmobook.com";
const FROM_DOMAIN = "mimmobook.com";
const OFFER_TEMPLATE_LABEL = "offer_email";
const OFFER_BUCKET = "tenant-private";
// Short-lived signed URL: 7 days. Long enough for recipients to act on an
// emailed offer, short enough to limit exposure if the email is forwarded
// or leaked. Resending an offer regenerates a fresh URL.
const OFFER_DOWNLOAD_TTL_SECONDS = 60 * 60 * 24 * 7;

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function stripHtml(value: string) {
  return value
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "");
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value: string, label: string): string {
  if (!UUID_REGEX.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

function safeFilenameOnly(value: string): string {
  // Strip any path component and disallow traversal sequences
  const base = value.split(/[/\\]/).pop() || "";
  const cleaned = base.replace(/\.\.+/g, ".").replace(/[^a-zA-Z0-9._-]/g, "");
  return cleaned || "Offer.pdf";
}

function decodeBase64(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function buildOfferHtml(messageBody: string, downloadUrl?: string) {
  const safeBody = escapeHtml(messageBody).replace(/\n/g, "<br />");
  const ctaBlock = downloadUrl
    ? `<div style="margin:32px 0 24px;">
        <a href="${escapeHtml(downloadUrl)}" style="display:inline-block;padding:14px 22px;background-color:#3f1f5c;color:#f9f6f1;text-decoration:none;border-radius:10px;font-weight:600;">
          Download offer PDF
        </a>
      </div>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#63516E;">
        If the button doesn't work, copy this link into your browser:<br />
        <a href="${escapeHtml(downloadUrl)}" style="color:#3f1f5c;word-break:break-all;">${escapeHtml(downloadUrl)}</a>
      </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:Inter,Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
    <tr>
      <td align="center" style="padding:30px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:0 auto;">
          <tr>
            <td style="padding:36px 32px;border:1px solid #eadfd4;border-radius:18px;background-color:#ffffff;color:#1E1519;font-size:15px;line-height:1.7;">
              ${safeBody}
              ${ctaBlock}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildOfferText(messageBody: string, downloadUrl?: string) {
  return [
    messageBody.trim(),
    downloadUrl ? `Download the offer PDF: ${downloadUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...corsHeaders } });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: { ...corsHeaders } });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
    } = await supabaseAdmin.auth.getUser(token);

    if (!user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: tenantUser } = await supabaseAdmin
      .from("tenant_users")
      .select("role, tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!tenantUser?.tenant_id) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const { to, subject, htmlBody, textBody, pdfBase64, pdfFilename, businessName, businessEmail } = await req.json();

    const recipientEmail = typeof to === "string" ? to.trim().toLowerCase() : "";
    const emailSubject = typeof subject === "string" ? subject.trim() : "";
    const messageBody = typeof textBody === "string" && textBody.trim()
      ? textBody.trim()
      : typeof htmlBody === "string"
        ? stripHtml(htmlBody)
        : "";

    if (!recipientEmail || !emailSubject || !messageBody) {
      return jsonResponse({ error: "Missing required fields" }, 400);
    }

    const { data: tenantSettings } = await supabaseAdmin
      .from("tenant_settings")
      .select("business_name, business_email")
      .eq("tenant_id", tenantUser.tenant_id)
      .maybeSingle();

    const displayName = (tenantSettings?.business_name || businessName || "MimmoBook")
      .replace(/[\r\n"]/g, "")
      .trim();
    const replyToEmail = (tenantSettings?.business_email || businessEmail || "").trim() || undefined;

    let downloadUrl: string | undefined;
    if (typeof pdfBase64 === "string" && pdfBase64.length > 0) {
      const safeFilename = safeFilenameOnly(pdfFilename || "Offer.pdf");
      const safeTenantId = assertUuid(tenantUser.tenant_id, "tenant id");
      const safeUserId = assertUuid(user.id, "user id");
      const filePath = `${safeTenantId}/offers/${safeUserId}/${Date.now()}-${safeFilename}`;
      const pdfBytes = decodeBase64(pdfBase64);

      const { error: uploadError } = await supabaseAdmin.storage
        .from(OFFER_BUCKET)
        .upload(filePath, pdfBytes, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Failed to prepare offer PDF: ${uploadError.message}`);
      }

      const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
        .from(OFFER_BUCKET)
        .createSignedUrl(filePath, OFFER_DOWNLOAD_TTL_SECONDS);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error(`Failed to create signed download URL: ${signedUrlError?.message ?? "unknown error"}`);
      }

      downloadUrl = signedUrlData.signedUrl;
    }

    const messageId = `offer-${crypto.randomUUID()}`;
    const generatedToken = crypto.randomUUID();

    await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .upsert({ email: recipientEmail, token: generatedToken }, { onConflict: "email", ignoreDuplicates: true });

    const { data: tokenRow } = await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", recipientEmail)
      .maybeSingle();

    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: OFFER_TEMPLATE_LABEL,
      recipient_email: recipientEmail,
      status: "pending",
      tenant_id: tenantUser.tenant_id,
    });

    const enqueuePayload: Record<string, unknown> = {
      to: recipientEmail,
      from: `${displayName} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: emailSubject,
      html: buildOfferHtml(messageBody, downloadUrl),
      text: buildOfferText(messageBody, downloadUrl),
      purpose: "transactional",
      label: OFFER_TEMPLATE_LABEL,
      message_id: messageId,
      idempotency_key: messageId,
      unsubscribe_token: tokenRow?.token || generatedToken,
      queued_at: new Date().toISOString(),
      tenant_id: tenantUser.tenant_id,
    };

    if (replyToEmail) {
      enqueuePayload.reply_to = replyToEmail;
    }

    const { error: enqueueError } = await supabaseAdmin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: enqueuePayload,
    });

    if (enqueueError) {
      await supabaseAdmin.from("email_send_log").insert({
        message_id: messageId,
        template_name: OFFER_TEMPLATE_LABEL,
        recipient_email: recipientEmail,
        status: "failed",
        error_message: "Failed to enqueue offer email",
        tenant_id: tenantUser.tenant_id,
      });

      return jsonResponse({ error: "Email send failed" }, 500);
    }

    return jsonResponse({ success: true, emailSent: true, queued: true, providerId: messageId });
  } catch (err) {
    console.error("Error sending offer email:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
