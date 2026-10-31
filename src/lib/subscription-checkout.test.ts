import { describe, expect, it } from "vitest";
import { checkoutUrl } from "./subscription-checkout";

describe("subscription checkout links", () => {
  it("rejects an empty checkout response", () => {
    for (const value of [undefined, null, "", 42]) {
      expect(checkoutUrl(value)).toBeNull();
    }
  });
  it("preserves trusted HTTPS checkout destinations", () => {
    expect(checkoutUrl("https://checkout.stripe.com/c/pay/test")).toBe(
      "https://checkout.stripe.com/c/pay/test",
    );
    expect(checkoutUrl("https://billing.stripe.com/p/session/test")).toBe(
      "https://billing.stripe.com/p/session/test",
    );
  });
  it("rejects untrusted hosts and executable links", () => {
    for (const value of [
      "javascript:alert(1)",
      "http://checkout.stripe.com/test",
      "https://checkout.stripe.com.evil.test/",
      "https://user@checkout.stripe.com/test",
    ]) {
      expect(checkoutUrl(value)).toBeNull();
    }
  });
});
