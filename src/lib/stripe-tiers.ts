/**
 * Stripe product/price mapping for subscription tiers.
 * Keep in sync with Stripe dashboard.
 */
export const STRIPE_TIERS = {
  basic: {
    price_id: "price_1TM3VZAi9C4ePV8hzIKzpZHb",
    product_id: "prod_UKix96usEYRAI5",
  },
  professional: {
    price_id: "price_1TM3VxAi9C4ePV8hP4Olb3GN",
    product_id: "prod_UKixFotA0EWI6Y",
  },
  business: {
    price_id: "price_1TM3bOAi9C4ePV8hv5EQysmt",
    product_id: "prod_UKj3UwZLsud11x",
  },
} as const;

export type StripeTierKey = keyof typeof STRIPE_TIERS;
