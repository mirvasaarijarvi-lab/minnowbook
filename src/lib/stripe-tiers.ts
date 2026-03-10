/**
 * Stripe product/price mapping for subscription tiers.
 * Keep in sync with Stripe dashboard.
 */
export const STRIPE_TIERS = {
  basic: {
    price_id: "price_1T9LDMAi9C4ePV8hwdTtDJwR",
    product_id: "prod_U7aOvw22WEGnnE",
  },
  professional: {
    price_id: "price_1T9LEYAi9C4ePV8hOkMDFa9r",
    product_id: "prod_U7aPSU6pnqumKl",
  },
  business: {
    price_id: "price_1T9LFNAi9C4ePV8hBMDXEnP5",
    product_id: "prod_U7aQxx51DHizuI",
  },
} as const;

export type StripeTierKey = keyof typeof STRIPE_TIERS;
