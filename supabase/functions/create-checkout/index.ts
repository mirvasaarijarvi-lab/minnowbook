import Stripe from "https://esm.sh/stripe@18.5.0";
import { getCorsHeaders, isOriginAllowed } from "../_shared/http-headers.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import {
  billingTenant,
  findBusinessSubscription,
  RECOVERABLE_STATUSES,
} from "../_shared/subscription-billing.ts";

const SAFE_ORIGIN_FALLBACK = "https://mimmobook.com";
const GENERIC_ERROR = "Payment service temporarily unavailable.";

// Self-serve subscriptions exist only for the three monthly plans. Enterprise is
// sold by offer and has no Stripe price, so any other price id is rejected here
// (keep in sync with src/lib/stripe-tiers.ts).
const ALLOWED_PRICE_IDS = new Set([
  "price_1TM3VZAi9C4ePV8hzIKzpZHb", // basic
  "price_1TM3VxAi9C4ePV8hP4Olb3GN", // professional
  "price_1TM3bOAi9C4ePV8hv5EQysmt", // business
]);

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-CHECKOUT] ${step}${d}`);
};

export async function handleCreateCheckoutRequest(
  req: Request,
): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Reject oversized request bodies (50KB max) — cheap pre-auth check.
  const MAX_BODY_SIZE = 50 * 1024;
  const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
  if (contentLength > MAX_BODY_SIZE) {
    return new Response(JSON.stringify({ error: "Request too large" }), {
      status: 413,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth-header short-circuit MUST happen before any createClient(...) call so
  // that missing/empty Supabase env vars cannot turn an expected 401 into a
  // 500 via `supabaseKey is required.`.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "No authorization header provided" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const auth = await requireAuth(req, corsHeaders, {
      caller: "create-checkout",
    });
    if (auth instanceof Response) return auth;
    const tenant = await billingTenant(auth.adminClient, auth.userId);
    if (!tenant) {
      return new Response(
        JSON.stringify({
          error: "Only a business owner or admin can buy a plan.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const tenantId = tenant.id;

    const { priceId } = await req.json();
    if (!priceId || typeof priceId !== "string") {
      throw new Error("priceId is required");
    }
    // Validate priceId format (Stripe price IDs start with "price_")
    if (!/^price_[a-zA-Z0-9]+$/.test(priceId)) {
      throw new Error("Invalid priceId format");
    }
    if (!ALLOWED_PRICE_IDS.has(priceId)) {
      return new Response(
        JSON.stringify({
          error:
            "This plan is not available for self-serve checkout. Request an offer instead.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
      timeout: 8000,
      maxNetworkRetries: 1,
    });

    const rawOrigin = req.headers.get("origin") ?? "";
    const origin = isOriginAllowed(rawOrigin)
      ? rawOrigin
      : SAFE_ORIGIN_FALLBACK;

    const existing = await findBusinessSubscription(stripe, tenant, auth.email);
    // Recover or change an existing subscription instead of charging for a second one.
    if (existing && RECOVERABLE_STATUSES.has(existing.status)) {
      const customer = typeof existing.customer === "string"
        ? existing.customer
        : existing.customer.id;
      const portal = await stripe.billingPortal.sessions.create({
        customer,
        return_url: `${origin}/dashboard?billing=return`,
      });
      return new Response(JSON.stringify({ url: portal.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const customerId = tenant.stripe_customer_id ||
      (typeof existing?.customer === "string" ? existing.customer : undefined);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : auth.email ?? undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      client_reference_id: tenantId,
      metadata: { tenant_id: tenantId },
      subscription_data: {
        trial_period_days: 14,
        metadata: { tenant_id: tenantId },
      },
      success_url: `${origin}/dashboard?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
    }, {
      idempotencyKey: `checkout-${tenantId}-${priceId}-${
        Math.floor(Date.now() / 300000)
      }`,
    });

    logStep("Checkout session created");

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch {
    console.error("[create-checkout] Checkout handoff failed");
    return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
}
Deno.serve(handleCreateCheckoutRequest);
