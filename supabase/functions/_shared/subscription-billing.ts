import { findBillingTenantId } from "../create-checkout/billing-access.ts";

export const PRICE_TO_TIER: Record<string, string> = {
  price_1TM3VZAi9C4ePV8hzIKzpZHb: "basic",
  price_1TM3VxAi9C4ePV8hP4Olb3GN: "professional",
  price_1TM3bOAi9C4ePV8hv5EQysmt: "business",
  price_1T9LDMAi9C4ePV8hwdTtDJwR: "basic",
  price_1T9LEYAi9C4ePV8hOkMDFa9r: "professional",
  price_1T9LFNAi9C4ePV8hBMDXEnP5: "business",
};
export const ENTITLED_STATUSES = new Set(["active", "trialing"]);
export const RECOVERABLE_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "paused",
  "incomplete",
]);

export async function billingTenant(client: any, userId: string) {
  const id = await findBillingTenantId(client, userId);
  if (!id) return null;
  const { data, error } = await client.from("tenants")
    .select(
      "id, tier, stripe_customer_id, stripe_subscription_id, sample_end_date",
    )
    .eq("id", id).single();
  if (error || !data) throw new Error("Business lookup failed");
  return data;
}

export function belongsToBusiness(subscription: any, tenant: any): boolean {
  const metadataTenant = subscription.metadata?.tenant_id;
  const customer = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id;
  return metadataTenant ? metadataTenant === tenant.id : Boolean(
    tenant.stripe_customer_id && customer === tenant.stripe_customer_id,
  );
}

export function chooseSubscription(subscriptions: any[], tenant: any) {
  const priorities = [
    "active",
    "trialing",
    "past_due",
    "unpaid",
    "paused",
    "incomplete",
    "canceled",
    "incomplete_expired",
  ];
  return subscriptions.filter((sub) => belongsToBusiness(sub, tenant))
    .sort((a, b) =>
      priorities.indexOf(a.status) - priorities.indexOf(b.status) ||
      b.created - a.created
    )[0] ?? null;
}

export function subscriptionPeriodEnd(subscription: any): string | null {
  // Basil moved the billing period onto subscription items.
  const seconds = subscription.items?.data?.[0]?.current_period_end ??
    subscription.current_period_end;
  return typeof seconds === "number" && Number.isFinite(seconds)
    ? new Date(seconds * 1000).toISOString()
    : null;
}

export async function findBusinessSubscription(
  stripe: any,
  tenant: any,
  email: string | null,
) {
  const candidates: any[] = [];
  // Stable business linkage survives owner and email changes.
  if (tenant.stripe_subscription_id) {
    try {
      const linked = await stripe.subscriptions.retrieve(
        tenant.stripe_subscription_id,
      );
      if (belongsToBusiness(linked, tenant)) candidates.push(linked);
    } catch (error) {
      // A removed legacy ID must not block discovery through the linked customer.
      if ((error as { code?: string }).code !== "resource_missing") throw error;
    }
  }
  const customers: string[] = [];
  if (tenant.stripe_customer_id) {
    customers.push(tenant.stripe_customer_id);
  } else if (email) {
    // Email is discovery only. Subscription metadata still authorizes it.
    for await (const customer of stripe.customers.list({ email, limit: 100 })) {
      customers.push(customer.id);
    }
  }
  for (const customer of customers) {
    for await (
      const sub of stripe.subscriptions.list({
        customer,
        status: "all",
        limit: 100,
      })
    ) candidates.push(sub);
  }
  return chooseSubscription(candidates, tenant);
}

export async function syncBusinessSubscription(
  client: any,
  tenant: any,
  subscription: any,
) {
  if (!subscription) return;
  const entitled = ENTITLED_STATUSES.has(subscription.status);
  const tier = PRICE_TO_TIER[subscription.items?.data?.[0]?.price?.id];
  if (entitled && !tier) throw new Error("Subscription plan not recognized");
  const onSample = tenant.sample_end_date &&
    tenant.sample_end_date >= new Date().toISOString().slice(0, 10);
  const customer = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id;
  const { error } = await client.from("tenants").update({
    ...(entitled ? { tier } : !onSample ? { tier: "basic" } : {}),
    // The paid subscription replaces an expired sample, including for staff
    // whose safe tenant view intentionally masks billing identifiers.
    ...(entitled && tenant.sample_end_date && !onSample
      ? { sample_start_date: null, sample_end_date: null }
      : {}),
    subscription_status: subscription.status,
    stripe_customer_id: customer,
    stripe_subscription_id: subscription.id,
  }).eq("id", tenant.id);
  if (error) throw new Error("Subscription could not be saved");
}
