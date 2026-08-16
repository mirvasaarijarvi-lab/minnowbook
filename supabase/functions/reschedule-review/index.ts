// Staff-side review of guest reschedule requests.
//
// Why an edge function instead of a direct client update:
//   Approving a request has to (a) move the reservation, (b) close the
//   request, and (c) tell the guest. Steps (a) and (b) must not drift apart,
//   and (c) needs the email queue, which the browser cannot reach. Doing all
//   three server-side keeps the three writes consistent and lets us email the
//   guest with the venue's sender identity.
import { getCorsHeaders } from "../_shared/http-headers.ts";
import { requireAuth } from "../_shared/require-auth.ts";

const SENDER_DOMAIN = "notify.mimmobook.com";

function escapeHtml(str: unknown): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function validateUuid(val: unknown): string {
  if (typeof val !== "string") throw new Error("Invalid request id");
  const trimmed = val.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    throw new Error("Invalid request id");
  }
  return trimmed;
}

export function validateStaffNote(val: unknown): string | null {
  if (val === undefined || val === null || val === "") return null;
  if (typeof val !== "string") throw new Error("Invalid note");
  const trimmed = val.trim();
  if (trimmed.length > 1000) throw new Error("Note too long");
  return trimmed.length > 0 ? trimmed : null;
}

const copyByLanguage: Record<
  string,
  { approved: { subject: string; title: string; body: string }; declined: { subject: string; title: string; body: string }; noteLabel: string }
> = {
  en: {
    approved: {
      subject: "Your new booking time is confirmed",
      title: "Change confirmed",
      body: "Your booking has been moved to",
    },
    declined: {
      subject: "About your booking change request",
      title: "Change not possible",
      body: "We could not move your booking. It stays as originally booked on",
    },
    noteLabel: "Message from the venue",
  },
  fi: {
    approved: {
      subject: "Uusi varausaikasi on vahvistettu",
      title: "Muutos vahvistettu",
      body: "Varauksesi on siirretty ajankohtaan",
    },
    declined: {
      subject: "Varauksesi muutospyynnöstä",
      title: "Muutos ei onnistu",
      body: "Emme voineet siirtää varaustasi. Se säilyy alkuperäisenä ajankohtana",
    },
    noteLabel: "Viesti kohteesta",
  },
  sv: {
    approved: {
      subject: "Din nya bokningstid är bekräftad",
      title: "Ändringen bekräftad",
      body: "Din bokning har flyttats till",
    },
    declined: {
      subject: "Om din begäran om bokningsändring",
      title: "Ändringen är inte möjlig",
      body: "Vi kunde inte flytta din bokning. Den gäller som ursprungligen bokad",
    },
    noteLabel: "Meddelande från platsen",
  },
};

export async function handleRescheduleReviewRequest(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req, { allowMethods: "POST, OPTIONS" });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = await requireAuth(req, corsHeaders, { caller: "reschedule-review" });
  if (auth instanceof Response) return auth;
  const { userId, adminClient } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    const requestId = validateUuid((body as Record<string, unknown>).request_id);
    const decision = String((body as Record<string, unknown>).decision ?? "");
    if (decision !== "approved" && decision !== "declined") {
      return json({ error: "Invalid decision" }, 400);
    }
    const staffNote = validateStaffNote((body as Record<string, unknown>).staff_note);

    const { data: request } = await adminClient
      .from("reschedule_requests")
      .select("id, tenant_id, reservation_id, requested_date, requested_start_time, requested_end_time, status")
      .eq("id", requestId)
      .maybeSingle();

    if (!request) return json({ error: "Request not found" }, 404);
    if (request.status !== "pending") return json({ error: "This request has already been reviewed." }, 409);

    // Authorization: caller must belong to the request's tenant with a
    // staff-or-above role. Membership is checked against the tenant on the
    // request row, never a tenant id supplied by the client.
    const { data: membership } = await adminClient
      .from("tenant_users")
      .select("role, is_approved")
      .eq("user_id", userId)
      .eq("tenant_id", request.tenant_id)
      .maybeSingle();

    const allowedRoles = ["owner", "admin", "superadmin", "staff"];
    if (!membership || membership.is_approved === false || !allowedRoles.includes(String(membership.role))) {
      return json({ error: "Insufficient permissions" }, 403);
    }

    const { data: reservation } = await adminClient
      .from("reservations")
      .select("id, tenant_id, date, start_time, end_time, guest_name, guest_email, language, status")
      .eq("id", request.reservation_id)
      .eq("tenant_id", request.tenant_id)
      .maybeSingle();

    if (!reservation) return json({ error: "Booking not found" }, 404);

    if (decision === "approved") {
      if (reservation.status === "cancelled") {
        return json({ error: "This booking has been cancelled." }, 409);
      }
      const { error: moveErr } = await adminClient
        .from("reservations")
        .update({
          date: request.requested_date,
          start_time: request.requested_start_time ?? reservation.start_time,
          end_time: request.requested_end_time ?? reservation.end_time,
        })
        .eq("id", reservation.id)
        .eq("tenant_id", request.tenant_id);

      if (moveErr) {
        console.error("Failed to move reservation", moveErr.message);
        return json({ error: "Could not move the booking." }, 500);
      }
    }

    const { error: closeErr } = await adminClient
      .from("reschedule_requests")
      .update({
        status: decision,
        staff_note: staffNote,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", request.id)
      .eq("status", "pending");

    if (closeErr) {
      console.error("Failed to close reschedule request", closeErr.message);
      return json({ error: "Could not update the request." }, 500);
    }

    const language = ["en", "fi", "sv"].includes(String(reservation.language)) ? String(reservation.language) : "en";
    const copy = copyByLanguage[language];
    const variant = decision === "approved" ? copy.approved : copy.declined;
    const shownDate = decision === "approved" ? request.requested_date : reservation.date;
    const shownTime = decision === "approved"
      ? (request.requested_start_time ?? reservation.start_time)
      : reservation.start_time;

    try {
      await adminClient.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          to: reservation.guest_email,
          from: `MimmoBook <noreply@${SENDER_DOMAIN}>`,
          sender_domain: SENDER_DOMAIN,
          subject: variant.subject,
          html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:32px;background:#ffffff;font-family:'Inter',Arial,sans-serif">
  <h1 style="color:#1E1519;font-size:22px;font-family:'Playfair Display',Georgia,serif;margin:0 0 12px">${variant.title}</h1>
  <p style="color:#63516E;font-size:15px;line-height:1.6">${variant.body} <strong>${escapeHtml(shownDate)}</strong>${shownTime ? ` ${escapeHtml(String(shownTime).slice(0, 5))}` : ""}.</p>
  ${staffNote ? `<p style="color:#63516E;font-size:14px;line-height:1.6"><strong>${copy.noteLabel}:</strong><br>${escapeHtml(staffNote)}</p>` : ""}
</body></html>`,
          purpose: "transactional",
          label: `reschedule_${decision}`,
          queued_at: new Date().toISOString(),
        },
      });
    } catch (mailErr) {
      console.error("Failed to enqueue reschedule decision email", mailErr);
    }

    return json({ ok: true, decision });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return json({ error: message }, 400);
  }
}

Deno.serve(handleRescheduleReviewRequest);
