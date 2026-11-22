import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const reminder = readFileSync(
  "supabase/functions/send-reminder/index.ts",
  "utf8",
);
const migration = readFileSync(
  "drizzle/migrations/0052_restrict_premium_support_insert.sql",
  "utf8",
);

describe("guest email membership approval", () => {
  it("fetches approval and refuses pending membership before privileged reads", () => {
    expect(reminder).toContain('.select("role, tenant_id, is_approved")');
    expect(reminder).toContain("!sysAdmin && callerRole?.is_approved !== true");
    expect(reminder.indexOf("callerRole?.is_approved !== true")).toBeLessThan(
      reminder.indexOf('.from("reservations")'),
    );
    expect(reminder).toContain("status: 403");
  });

  it("preserves independently verified system-admin access", () => {
    expect(reminder).toContain('.from("system_admins")');
    expect(reminder).toContain('.eq("user_id", callingUser.id)');
    expect(reminder).toContain('.eq("tenant_id", tenantId)');
  });
});

describe("premium support plan enforcement", () => {
  it("restricts every insert, including permissive owner/admin policies", () => {
    expect(migration).toContain("AS RESTRICTIVE FOR INSERT TO authenticated");
    expect(migration).toContain("user_id = auth.uid()");
    expect(migration).toContain(
      "public.is_user_tenant_member(auth.uid(), tenant_id)",
    );
    expect(migration).toContain("t.id = support_requests.tenant_id");
    expect(migration).toContain("t.is_active = true");
    expect(migration).toContain("t.tier IN ('business', 'enterprise')");
    expect(migration).toContain("public.is_system_admin(auth.uid())");
  });
});
