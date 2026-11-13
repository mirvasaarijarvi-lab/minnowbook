import Stripe from "https://esm.sh/stripe@18.5.0";
import { getCorsHeaders } from "../_shared/http-headers.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import {
  billingTenant,
  ENTITLED_STATUSES,
  findBusinessSubscription,
  PRICE_TO_TIER,
  subscriptionPeriodEnd,
  syncBusinessSubscription,
} from "../_shared/subscription-billing.ts";

export async function handleCheckSubscriptionRequest(
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
    const auth = await requireAuth(req, headers, {
      caller: "check-subscription",
    });
    if (auth instanceof Response) return auth;
    const tenant = await billingTenant(auth.adminClient, auth.userId);
    if (!tenant) return respond({ subscribed: false });
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
      timeout: 8000,
      maxNetworkRetries: 1,
    });
    const subscription = await findBusinessSubscription(
      stripe,
      tenant,
      auth.email,
    );
    await syncBusinessSubscription(auth.adminClient, tenant, subscription);
    return respond({
      subscribed: Boolean(
        subscription && ENTITLED_STATUSES.has(subscription.status),
      ),
      tier: subscription && ENTITLED_STATUSES.has(subscription.status)
        ? PRICE_TO_TIER[subscription.items?.data?.[0]?.price?.id] ?? null
        : null,
      subscription_end: subscription
        ? subscriptionPeriodEnd(subscription)
        : null,
      subscription_status: subscription?.status ?? null,
    });
  } catch {
    console.error("[check-subscription] Subscription check failed");
    return respond(
      { error: "Subscription service temporarily unavailable." },
      503,
    );
  }
}
Deno.serve(handleCheckSubscriptionRequest);
