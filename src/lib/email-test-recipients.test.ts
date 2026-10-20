import { describe, expect, it } from "vitest";
import { isTestRecipient } from "./email-test-recipients";

describe("isTestRecipient", () => {
  it("treats reserved example.com test addresses as test recipients", () => {
    expect(isTestRecipient("test-smoke-1792482286021@example.com")).toBe(true);
  });
  it("treats .test addresses as test recipients", () => {
    expect(isTestRecipient("user@example.test")).toBe(true);
  });
  it("keeps real addresses in the delivery warning", () => {
    expect(isTestRecipient("mirvasaarijarvi@gmail.com")).toBe(false);
    expect(isTestRecipient("owner@mimmobook.com")).toBe(false);
  });
});
