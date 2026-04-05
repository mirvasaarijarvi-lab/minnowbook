import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

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


const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-SUBSCRIPTION] ${step}${d}`);
};

// Map Stripe price IDs to tier names
const PRICE_TO_TIER: Record<string, string> = {
  "price_1T9LDMAi9C4ePV8hwdTtDJwR": "basic",
  "price_1T9LEYAi9C4ePV8hOkMDFa9r": "professional",
  "price_1T9LFNAi9C4ePV8hBMDXEnP5": "business",
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

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

    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found customer", { customerId });

    // Check active or trialing subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    // Also check trialing
    const trialingSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: "trialing",
      limit: 1,
    });

    const allSubs = [...subscriptions.data, ...trialingSubs.data];
    const hasActiveSub = allSubs.length > 0;

    let tier = null;
    let subscriptionEnd = null;
    let subscriptionStatus = null;
    let stripeSubscriptionId = null;
    let stripeCustomerId = customerId;

    if (hasActiveSub) {
      const subscription = allSubs[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      subscriptionStatus = subscription.status;
      stripeSubscriptionId = subscription.id;
      const priceId = subscription.items.data[0]?.price?.id;
      tier = PRICE_TO_TIER[priceId] || null;
      logStep("Active subscription found", { tier, status: subscriptionStatus, priceId });

      // Sync tier to tenant table
      const { data: tenantUser } = await supabaseClient
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (tenantUser && tier) {
        await supabaseClient
          .from("tenants")
          .update({
            tier,
            subscription_status: subscriptionStatus,
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: stripeSubscriptionId,
          })
          .eq("id", tenantUser.tenant_id);
        logStep("Synced tier to tenant", { tenantId: tenantUser.tenant_id, tier });
      }
    } else {
      logStep("No active subscription found");
    }

    return new Response(
      JSON.stringify({
        subscribed: hasActiveSub,
        tier,
        subscription_end: subscriptionEnd,
        subscription_status: subscriptionStatus,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
