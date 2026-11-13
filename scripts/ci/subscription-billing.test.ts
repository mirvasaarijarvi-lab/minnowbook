import { describe, expect, it, vi } from "vitest";
import { belongsToBusiness, chooseSubscription, findBusinessSubscription, subscriptionPeriodEnd, syncBusinessSubscription, RECOVERABLE_STATUSES } from "../../supabase/functions/_shared/subscription-billing";
const tenant = { id: "business-a", stripe_customer_id: "cus_a", stripe_subscription_id: "sub_a", tier: "business" };
const sub = { id: "sub_a", status: "active", customer: "cus_a", created: 1, metadata: { tenant_id: "business-a" }, items: { data: [{ price: { id: "price_1TM3bOAi9C4ePV8hv5EQysmt" }, current_period_end: 1800000000 }] } };
describe("business-bound billing recovery", () => {
  it("uses Basil item billing dates without throwing on missing dates", () => {
    expect(subscriptionPeriodEnd(sub)).toBe("2027-01-15T08:00:00.000Z");
    expect(subscriptionPeriodEnd({ items: { data: [] } })).toBeNull();
  });
  it("does not borrow another business's active subscription", () => {
    const other = { ...sub, metadata: { tenant_id: "business-b" } };
    expect(belongsToBusiness(other, tenant)).toBe(false);
    expect(chooseSubscription([other, { ...sub, status: "past_due" }], tenant)?.status).toBe("past_due");
  });
  it("finds an existing subscription after the administrator changes email", async () => {
    const stripe = { customers: { list: vi.fn() }, subscriptions: { retrieve: vi.fn().mockResolvedValue(sub), list: vi.fn().mockReturnValue((async function* () { yield sub; })()) } };
    expect(await findBusinessSubscription(stripe, tenant, "changed@example.test")).toEqual(sub);
    expect(stripe.customers.list).not.toHaveBeenCalled();
    expect(stripe.subscriptions.list).toHaveBeenCalledWith({ customer: "cus_a", status: "all", limit: 100 });
  });
  it("checks beyond the first Stripe customer and subscription", async () => {
    const stripe = { customers: { list: () => (async function* () { yield { id: "cus_other" }; yield { id: "cus_a" }; })() }, subscriptions: { list: ({ customer }: any) => (async function* () { if (customer === "cus_a") yield sub; else yield { ...sub, metadata: { tenant_id: "other" } }; })() } };
    expect(await findBusinessSubscription(stripe, { id: "business-a" }, "owner@example.test")).toEqual(sub);
  });
  it.each(["active", "trialing", "past_due", "unpaid", "paused", "incomplete"])("recovers %s instead of creating a duplicate", (status) => {
    expect(RECOVERABLE_STATUSES.has(status)).toBe(true);
  });
  it("does not report a subscription restored if saving fails", async () => {
    const client = { from: () => ({ update: () => ({ eq: async () => ({ error: new Error("save failed") }) }) }) };
    await expect(syncBusinessSubscription(client, tenant, sub)).rejects.toThrow("Subscription could not be saved");
  });
  it("does not downgrade a business on an empty provider response", async () => {
    const client = { from: vi.fn() };
    await syncBusinessSubscription(client, tenant, null);
    expect(client.from).not.toHaveBeenCalled();
  });
});