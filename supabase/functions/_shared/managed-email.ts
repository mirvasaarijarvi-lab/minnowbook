// Direct send through Lovable's managed email API, used by the edge-function
// senders that build their own HTML at send time. Delivery, retries,
// suppression and unsubscribe handling run on Lovable's side; this helper
// only records the outcome in email_send_log (sent / suppressed / failed).
import { EmailAPIError, sendLovableEmail } from "npm:@lovable.dev/email-js@^0.3.1";

export interface ManagedEmail {
  to: string;
  from: string;
  sender_domain: string;
  subject: string;
  html: string;
  text?: string;
  label: string;
  idempotency_key?: string;
  reply_to?: string;
  message_id?: string | null;
  tenant_id?: string | null;
}

export type ManagedSendResult =
  | { sent: true }
  | { sent: false; reason: "recipient_suppressed" };

function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
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

// deno-lint-ignore no-explicit-any
async function logOutcome(admin: any, email: ManagedEmail, status: string, errorMessage?: string) {
  const { error } = await admin.from("email_send_log").insert({
    message_id: email.message_id ?? null,
    template_name: email.label,
    recipient_email: email.to,
    status,
    ...(errorMessage ? { error_message: errorMessage.slice(0, 1000) } : {}),
    tenant_id: email.tenant_id ?? null,
  });
  if (error) {
    console.error("Failed to write email send log", { code: error.code, message: error.message });
  }
}

/**
 * Sends one email. Resolves { sent: true } or { sent: false } for a
 * suppressed recipient; throws on any other failure.
 */
// deno-lint-ignore no-explicit-any
export async function sendManagedEmail(admin: any, email: ManagedEmail): Promise<ManagedSendResult> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  try {
    await sendLovableEmail(
      {
        to: email.to,
        from: email.from,
        sender_domain: email.sender_domain,
        subject: email.subject,
        html: email.html,
        text: email.text || htmlToText(email.html),
        purpose: "transactional",
        label: email.label,
        idempotency_key: email.idempotency_key || crypto.randomUUID(),
        ...(email.reply_to ? { reply_to: email.reply_to } : {}),
      },
      { apiKey, sendUrl: Deno.env.get("LOVABLE_SEND_URL") },
    );
  } catch (error) {
    if (error instanceof EmailAPIError && error.code === "recipient_suppressed") {
      await logOutcome(admin, email, "suppressed");
      return { sent: false, reason: "recipient_suppressed" };
    }
    const msg = error instanceof Error ? error.message : String(error);
    await logOutcome(admin, email, "failed", msg);
    throw error;
  }

  await logOutcome(admin, email, "sent");
  return { sent: true };
}
