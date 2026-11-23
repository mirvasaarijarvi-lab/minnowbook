import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { syncBusinessSubscription } from "./subscription-billing.ts";

const tenant = { id: "t1", stripe_customer_id: "cus_1", sample_end_date: null };
function client(updates: unknown[]) {
  return {
    from: () => ({
      update: (u: unknown) => ({
        eq: async () => {
          updates.push(u);
          return { error: null };
        },
      }),
    }),
  };
}
const paid = {
  id: "sub_1",
  object: "subscription",
  status: "active",
  customer: "cus_1",
  metadata: { tenant_id: "t1" },
  items: { data: [{ price: { id: "price_1TM3bOAi9C4ePV8hv5EQysmt" } }] },
};

Deno.test("plan is saved from Stripe's fresh record, not the passed copy", async () => {
  const updates: any[] = [];
  const stripe = {
    subscriptions: { retrieve: async () => ({ ...paid, status: "canceled" }) },
  };
  await syncBusinessSubscription(client(updates), tenant, paid, stripe);
  assertEquals(updates[0].tier, "basic");
});

Deno.test("subscription of another business is refused", async () => {
  const updates: any[] = [];
  const stripe = {
    subscriptions: {
      retrieve: async () => ({
        ...paid,
        customer: "cus_x",
        metadata: { tenant_id: "t2" },
      }),
    },
  };
  await assertRejects(() =>
    syncBusinessSubscription(client(updates), tenant, paid, stripe)
  );
  assertEquals(updates.length, 0);
});
