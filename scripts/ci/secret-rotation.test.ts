import { describe, it, expect } from "vitest";
import {
  loadInventory,
  listSecrets,
  findSecret,
  buildPlan,
  checkEnvironment,
  containsSecretValue,
} from "./secret-rotation.mjs";

describe("secret rotation inventory", () => {
  it("loads and validates every entry", () => {
    const inventory = loadInventory();
    expect(inventory.secrets.length).toBeGreaterThan(0);
    for (const secret of inventory.secrets) {
      expect(secret.name).toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(secret.steps.length).toBeGreaterThan(0);
      expect(secret.rotationDays).toBeGreaterThan(0);
    }
  });

  it("covers the credentials the project actually stores", () => {
    const names = listSecrets().map((s) => s.name);
    expect(names).toContain("LOVABLE_API_KEY");
    expect(names).toContain("STRIPE_SECRET_KEY");
    expect(names).toContain("RESEND_API_KEY");
    expect(names).toContain("GOOGLE_SEARCH_CONSOLE_API_KEY");
    expect(names).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("finds a credential by exact name and by fragment", () => {
    expect(findSecret("stripe_secret_key")?.name).toBe("STRIPE_SECRET_KEY");
    expect(findSecret("RESEND")?.name).toBe("RESEND_API_KEY");
    expect(findSecret("")).toBeNull();
  });
});

describe("rotation plan", () => {
  it("rejects an unknown credential and names the known ones", () => {
    expect(() => buildPlan("NOPE_KEY")).toThrow(/unknown credential/i);
    expect(() => buildPlan("NOPE_KEY")).toThrow(/STRIPE_SECRET_KEY/);
  });

  it("puts preparation before the credential steps and cleanup last", () => {
    const plan = buildPlan("RESEND_API_KEY");
    expect(plan.steps[0]).toMatch(/routine rotation or a suspected exposure/i);
    expect(plan.steps.at(-1)).toMatch(/close it with a note/i);
    expect(plan.steps.join("\n")).toMatch(/create a NEW key/i);
  });

  it("warns that a provider key stays valid until revoked", () => {
    const plan = buildPlan("STRIPE_SECRET_KEY");
    expect(plan.warnings.join("\n")).toMatch(/does not disable the old one/i);
  });

  it("warns that live traffic needs a republish", () => {
    const plan = buildPlan("VITE_SUPABASE_PUBLISHABLE_KEY");
    expect(plan.warnings.join("\n")).toMatch(/until you republish/i);
    expect(plan.verify).toContain("bunx vite build");
  });

  it("warns that a shared secret must match on both sides", () => {
    const plan = buildPlan("WEBHOOK_SIGNING_SECRET");
    expect(plan.warnings.join("\n")).toMatch(/same value/i);
    expect(plan.steps.join("\n")).toMatch(/openssl rand -hex 32/);
  });

  it("escalates a compromised rotation and adds revocation first", () => {
    const plan = buildPlan("STRIPE_SECRET_KEY", { compromised: true });
    expect(plan.compromised).toBe(true);
    expect(plan.steps[0]).toMatch(/rotate first, investigate second/i);
    expect(plan.steps.join("\n")).toMatch(/Revoke the old/);
    expect(plan.steps.at(-1)).toMatch(/Review access made with the old value/i);
  });

  it("does not add a revoke-first step for a self-revoking credential", () => {
    const plan = buildPlan("LOVABLE_API_KEY", { compromised: true });
    expect(plan.steps.join("\n")).not.toMatch(/Revoke the old Lovable/);
  });

  it("tells the caller a service role key cannot be read back", () => {
    const plan = buildPlan("SUPABASE_SERVICE_ROLE_KEY");
    expect(plan.warnings.join("\n")).toMatch(/cannot be read back/i);
  });

  it("never emits anything that looks like a credential value", () => {
    for (const secret of listSecrets()) {
      const plan = buildPlan(secret.name, { compromised: true });
      expect(containsSecretValue(JSON.stringify(plan))).toBe(false);
    }
  });
});

describe("environment check", () => {
  it("reports presence only, never a value", () => {
    const rows = checkEnvironment({
      STRIPE_SECRET_KEY: "sk_live_thisisnotarealkeyvalue",
      RESEND_API_KEY: "   ",
    });
    const stripe = rows.find((r) => r.name === "STRIPE_SECRET_KEY");
    const resend = rows.find((r) => r.name === "RESEND_API_KEY");
    expect(stripe).toEqual({
      name: "STRIPE_SECRET_KEY",
      present: true,
      kind: "third-party",
    });
    expect(resend?.present).toBe(false);
    expect(containsSecretValue(JSON.stringify(rows))).toBe(false);
  });

  it("omits shared secrets, which have no single canonical name", () => {
    const names = checkEnvironment({}).map((r) => r.name);
    expect(names).not.toContain("WEBHOOK_SIGNING_SECRET");
  });

  it("recognises value-shaped strings", () => {
    expect(containsSecretValue("sk_live_abcdefghijklmnop")).toBe(true);
    expect(containsSecretValue("rotate the payment key")).toBe(false);
  });
});
