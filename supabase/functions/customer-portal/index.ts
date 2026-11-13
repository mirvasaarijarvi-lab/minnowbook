import Stripe from "https://esm.sh/stripe@18.5.0";
import { getCorsHeaders, isOriginAllowed } from "../_shared/http-headers.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import {
  billingTenant,
  findBusinessSubscription,
} from "../_shared/subscription-billing.ts";

export async function handleCustomerPortalRequest(
  req: Request,
): Promise<Response> {
  const headers = {
    ...getCorsHeaders(req),
    "Content-Type": "application/json",
  };
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { headers, status });
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (Number(req.headers.get("content-length")) > 50 * 1024) {
    return respond({ error: "Request too large" }, 413);
  }
  try {
    const auth = await requireAuth(req, headers, { caller: "customer-portal" });
    if (auth instanceof Response) return auth;
    const tenant = await billingTenant(auth.adminClient, auth.userId);
    if (!tenant) {
      return respond({
        error: "Only a business owner or admin can manage a plan.",
      }, 403);
    }
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
      timeout: 8000,
      maxNetworkRetries: 1,
    });
    let customer = tenant.stripe_customer_id;
    if (!customer) {
      const sub = await findBusinessSubscription(stripe, tenant, auth.email);
      customer = typeof sub?.customer === "string"
        ? sub.customer
        : sub?.customer?.id;
    }
    if (!customer) {
      return respond({
        error: "No subscription found for this business.",
        code: "NO_SUBSCRIPTION",
      }, 404);
    }
    const rawOrigin = req.headers.get("origin") ?? "";
    const origin = isOriginAllowed(rawOrigin)
      ? rawOrigin
      : "https://mimmobook.com";
    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${origin}/dashboard?billing=return`,
    });
    return respond({ url: session.url });
  } catch {
    console.error("[customer-portal] Portal handoff failed");
    return respond({ error: "Payment service temporarily unavailable." }, 503);
  }
}
Deno.serve(handleCustomerPortalRequest);
