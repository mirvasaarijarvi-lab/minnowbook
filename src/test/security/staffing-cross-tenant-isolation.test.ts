import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  createTenantPairFixture,
  tenantPairFixtureLikelyAvailable,
  type TenantPairFixture,
} from "./fixtures/tenant-pair";

/**
 * Authenticated tenant isolation for Staffing and location access records.
 *
 * Business A's owner creates a real set of staffing and location access
 * records in business A (location, role, staff member, contact details,
 * shift list, row, shift, settings, access review, change request; the
 * database adds the shift change log and location change log rows itself).
 *
 * Signed-in users from business B then try to read, change, delete and
 * forge each record:
 *   - B's owner (from the tenant pair fixture), always
 *   - B's shift staff account (role "staff"), when the service role key is
 *     available to create it
 *
 * Every attempt must see zero rows, and a service-free re-read as A's owner
 * confirms nothing was changed or deleted. Positive controls prove the
 * records exist and that A's own staff account CAN read A's shift lists, so
 * a denial can never pass just because the data is missing.
 */

const SUPABASE_URL =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ??
  process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const RUN_TAG = `iso-${Date.now().toString(36)}`;
const STAFF_SPECS = {
  a: {
    email: "rls-fixture-staff-a@mimmobook.local",
    password: "RlsFixtureStaffA!2099",
  },
  b: {
    email: "rls-fixture-staff-b@mimmobook.local",
    password: "RlsFixtureStaffB!2099",
  },
};

type Seeded = {
  siteId: string;
  roleId: string;
  memberId: string;
  periodId: string;
  slotId: string;
  shiftId: string;
  reviewId: string;
  requestId: string;
};

/** One row per table: how to find the seeded record and a harmless update. */
type Target = {
  table: string;
  idColumn: string;
  id: (s: Seeded, tenantId: string) => string;
  update: Record<string, unknown>;
  /** Minimal forged insert into business A (tenant_id = A). */
  forge: (s: Seeded, tenantId: string) => Record<string, unknown>;
};

const TARGETS: Target[] = [
  {
    table: "staff_roles",
    idColumn: "id",
    id: (s) => s.roleId,
    update: { name_en: "hacked" },
    forge: (_s, t) => ({
      tenant_id: t,
      key: `${RUN_TAG}-forged`,
      name_en: "x",
      name_fi: "x",
      name_sv: "x",
    }),
  },
  {
    table: "staff_members",
    idColumn: "id",
    id: (s) => s.memberId,
    update: { name: "hacked" },
    forge: (_s, t) => ({ tenant_id: t, name: `${RUN_TAG} forged` }),
  },
  {
    table: "staff_member_contacts",
    idColumn: "staff_member_id",
    id: (s) => s.memberId,
    update: { phone: "+000" },
    forge: (s, t) => ({
      tenant_id: t,
      staff_member_id: s.memberId,
      email: "forged@example.invalid",
    }),
  },
  {
    table: "shift_periods",
    idColumn: "id",
    id: (s) => s.periodId,
    update: { title: "hacked" },
    forge: (_s, t) => ({
      tenant_id: t,
      start_date: "2099-01-05",
      title: `${RUN_TAG} forged`,
    }),
  },
  {
    table: "shift_slots",
    idColumn: "id",
    id: (s) => s.slotId,
    update: { notes: "hacked" },
    forge: (s, t) => ({ tenant_id: t, period_id: s.periodId }),
  },
  {
    table: "shifts",
    idColumn: "id",
    id: (s) => s.shiftId,
    update: { code: "X" },
    forge: (s, t) => ({ tenant_id: t, slot_id: s.slotId, date: "2099-01-06" }),
  },
  {
    table: "staffing_settings",
    idColumn: "tenant_id",
    id: (_s, t) => t,
    update: { settings: { hacked: true } },
    forge: (_s, t) => ({ tenant_id: t, settings: { forged: true } }),
  },
  {
    table: "site_access_reviews",
    idColumn: "id",
    id: (s) => s.reviewId,
    update: { snapshot: { hacked: true } },
    forge: (s, t) => ({ tenant_id: t, site_id: s.siteId, snapshot: {} }),
  },
  {
    table: "site_access_change_requests",
    idColumn: "id",
    id: (s) => s.requestId,
    update: { status: "done" },
    forge: (s, t) => ({
      tenant_id: t,
      site_id: s.siteId,
      subject_kind: "staff",
      subject_id: s.memberId,
      note: "forged",
    }),
  },
];

/** Tables the database fills in itself; attackers only get to read them. */
const LOG_TABLES = ["shift_change_log", "site_access_change_log"] as const;

function newClient(key = SUPABASE_ANON_KEY!): SupabaseClient {
  return createClient(SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function must<T>(
  label: string,
  p: PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${label} failed: ${error.message}`);
  if (data == null) throw new Error(`${label} returned nothing`);
  return data;
}

/** Create (or reuse) a shift-staff account in a tenant. Needs the service role. */
async function ensureStaffUser(
  admin: SupabaseClient,
  spec: { email: string; password: string },
  tenantId: string,
): Promise<SupabaseClient> {
  let userId: string | undefined;
  const created = await admin.auth.admin.createUser({
    email: spec.email,
    password: spec.password,
    email_confirm: true,
  });
  if (created.data.user) {
    userId = created.data.user.id;
  } else {
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) throw new Error(`listUsers failed: ${error.message}`);
      userId = data.users.find(
        (u) => u.email?.toLowerCase() === spec.email,
      )?.id;
      if (data.users.length < 200) break;
    }
  }
  if (!userId) throw new Error(`Could not create or find ${spec.email}`);

  const { data: membership } = await admin
    .from("tenant_users")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) {
    await must(
      "tenant_users insert (staff)",
      admin
        .from("tenant_users")
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          role: "staff",
          is_approved: true,
          display_name: "RLS staff fixture",
        })
        .select("tenant_id")
        .single(),
    );
  } else if (membership.tenant_id !== tenantId || membership.role !== "staff") {
    throw new Error(
      `${spec.email} is ${membership.role} in ${membership.tenant_id}, expected staff in ${tenantId}. Fix the fixture account.`,
    );
  }

  const client = newClient();
  const { error } = await client.auth.signInWithPassword(spec);
  if (error) throw new Error(`Sign-in for ${spec.email} failed: ${error.message}`);
  return client;
}

describe.runIf(tenantPairFixtureLikelyAvailable())(
  "Staffing and location access: authenticated cross-tenant isolation",
  () => {
    let fixture: TenantPairFixture;
    let ownerA: SupabaseClient;
    let tenantA: string;
    let tenantB: string;
    let seeded: Seeded;
    let staffA: SupabaseClient | undefined;
    const attackers: Array<{ label: string; client: SupabaseClient }> = [];
    let hadSettings = false;

    beforeAll(async () => {
      fixture = await createTenantPairFixture();
      if (!fixture.available || !fixture.a || !fixture.b) {
        throw new Error(`Tenant pair fixture unavailable: ${fixture.skipReason}`);
      }
      ownerA = fixture.a.client;
      tenantA = fixture.a.tenantId;
      tenantB = fixture.b.tenantId;
      expect(tenantA).not.toBe(tenantB);
      attackers.push({ label: "business B owner", client: fixture.b.client });

      if (SERVICE_KEY) {
        const admin = newClient(SERVICE_KEY);
        staffA = await ensureStaffUser(admin, STAFF_SPECS.a, tenantA);
        attackers.push({
          label: "business B shift staff",
          client: await ensureStaffUser(admin, STAFF_SPECS.b, tenantB),
        });
      }

      // Seed business A as its own owner (RLS applies, no service role).
      const site = await must(
        "sites insert",
        ownerA
          .from("sites")
          .insert({ tenant_id: tenantA, name: `${RUN_TAG} site`, slug: RUN_TAG })
          .select("id")
          .single(),
      );
      const role = await must(
        "staff_roles insert",
        ownerA
          .from("staff_roles")
          .insert({
            tenant_id: tenantA,
            key: RUN_TAG,
            name_en: "Iso role",
            name_fi: "Iso role",
            name_sv: "Iso role",
          })
          .select("id")
          .single(),
      );
      const member = await must(
        "staff_members insert",
        ownerA
          .from("staff_members")
          .insert({
            tenant_id: tenantA,
            name: `${RUN_TAG} worker`,
            role_keys: [RUN_TAG],
            site_ids: [site.id],
          })
          .select("id")
          .single(),
      );
      // Moving the worker makes the database write a location change log row.
      await must(
        "staff_members move",
        ownerA
          .from("staff_members")
          .update({ site_ids: [] })
          .eq("id", member.id)
          .select("id")
          .single(),
      );
      await must(
        "staff_member_contacts insert",
        ownerA
          .from("staff_member_contacts")
          .insert({
            tenant_id: tenantA,
            staff_member_id: member.id,
            email: "worker@example.invalid",
            phone: "+358000000",
          })
          .select("staff_member_id")
          .single(),
      );
      const period = await must(
        "shift_periods insert",
        ownerA
          .from("shift_periods")
          .insert({
            tenant_id: tenantA,
            site_id: site.id,
            start_date: "2099-01-05",
            title: `${RUN_TAG} list`,
          })
          .select("id")
          .single(),
      );
      const slot = await must(
        "shift_slots insert",
        ownerA
          .from("shift_slots")
          .insert({
            tenant_id: tenantA,
            period_id: period.id,
            role_key: RUN_TAG,
            staff_member_id: member.id,
          })
          .select("id")
          .single(),
      );
      const shift = await must(
        "shifts insert",
        ownerA
          .from("shifts")
          .insert({
            tenant_id: tenantA,
            slot_id: slot.id,
            date: "2099-01-05",
            start_time: "08:00",
            end_time: "16:00",
          })
          .select("id")
          .single(),
      );
      const { data: existingSettings } = await ownerA
        .from("staffing_settings")
        .select("tenant_id")
        .eq("tenant_id", tenantA)
        .maybeSingle();
      hadSettings = Boolean(existingSettings);
      if (!hadSettings) {
        await must(
          "staffing_settings insert",
          ownerA
            .from("staffing_settings")
            .insert({ tenant_id: tenantA, settings: {} })
            .select("tenant_id")
            .single(),
        );
      }
      const review = await must(
        "site_access_reviews insert",
        ownerA
          .from("site_access_reviews")
          .insert({
            tenant_id: tenantA,
            site_id: site.id,
            snapshot: {},
            accepted_by: fixture.a.userId,
          })
          .select("id")
          .single(),
      );
      const request = await must(
        "site_access_change_requests insert",
        ownerA
          .from("site_access_change_requests")
          .insert({
            tenant_id: tenantA,
            site_id: site.id,
            subject_kind: "staff",
            subject_id: member.id,
            note: `${RUN_TAG} request`,
            created_by: fixture.a.userId,
          })
          .select("id")
          .single(),
      );

      seeded = {
        siteId: site.id,
        roleId: role.id,
        memberId: member.id,
        periodId: period.id,
        slotId: slot.id,
        shiftId: shift.id,
        reviewId: review.id,
        requestId: request.id,
      };
    });

    afterAll(async () => {
      if (!ownerA || !seeded) return;
      const del = (table: string, col: string, val: string) =>
        ownerA.from(table).delete().eq(col, val);
      await del("site_access_change_requests", "id", seeded.requestId);
      await del("shifts", "id", seeded.shiftId);
      await del("shift_slots", "id", seeded.slotId);
      await del("shift_periods", "id", seeded.periodId);
      await del("staff_member_contacts", "staff_member_id", seeded.memberId);
      await del("staff_members", "id", seeded.memberId);
      await del("staff_roles", "id", seeded.roleId);
      if (!hadSettings) await del("staffing_settings", "tenant_id", tenantA);
      // Access reviews have no delete policy for owners; remove with the
      // service role when available, before the location they point to.
      if (SERVICE_KEY) {
        const admin = newClient(SERVICE_KEY);
        await admin.from("site_access_reviews").delete().eq("id", seeded.reviewId);
        await admin
          .from("site_access_change_log")
          .delete()
          .eq("subject_id", seeded.memberId);
        await admin
          .from("shift_change_log")
          .delete()
          .eq("period_id", seeded.periodId);
      }
      await del("sites", "id", seeded.siteId);
    });

    describe("positive controls", () => {
      it.each(TARGETS.map((t) => [t.table, t] as const))(
        "business A owner can read the seeded %s record",
        async (_name, t) => {
          const { data, error } = await ownerA
            .from(t.table)
            .select(t.idColumn)
            .eq(t.idColumn, t.id(seeded, tenantA));
          expect(error).toBeNull();
          expect(data?.length).toBe(1);
        },
      );

      it("the database logged the worker's location change", async () => {
        const { data, error } = await ownerA
          .from("site_access_change_log")
          .select("id")
          .eq("subject_id", seeded.memberId);
        expect(error).toBeNull();
        expect(data?.length ?? 0).toBeGreaterThan(0);
      });

      it("business A shift staff can read A's shift lists", async () => {
        if (!staffA) return; // needs the service role to create the account
        const { data, error } = await staffA
          .from("shift_periods")
          .select("id")
          .eq("id", seeded.periodId);
        expect(error).toBeNull();
        expect(data?.length).toBe(1);
      });
    });

    const attackerCases = () =>
      attackers.flatMap((a) => TARGETS.map((t) => [a.label, t.table, a, t] as const));

    it("covers both attacker roles when the service role is available", () => {
      expect(attackers.length).toBe(SERVICE_KEY ? 2 : 1);
    });

    it("every attacker is signed in to business B, not A", async () => {
      for (const a of attackers) {
        const { data } = await a.client.from("tenant_users").select("tenant_id");
        const ids = (data ?? []).map((r) => r.tenant_id);
        expect(ids, a.label).toContain(tenantB);
        expect(ids, a.label).not.toContain(tenantA);
      }
    });

    it("cannot read any of business A's records by id or tenant", async () => {
      for (const [label, table, a, t] of attackerCases()) {
        const byId = await a.client
          .from(table)
          .select("*")
          .eq(t.idColumn, t.id(seeded, tenantA));
        expect(byId.data ?? [], `${label} read ${table} by id`).toEqual([]);
        const byTenant = await a.client
          .from(table)
          .select("tenant_id")
          .eq("tenant_id", tenantA)
          .limit(5);
        expect(byTenant.data ?? [], `${label} read ${table} by tenant`).toEqual([]);
      }
      for (const a of attackers) {
        for (const table of LOG_TABLES) {
          const { data } = await a.client
            .from(table)
            .select("id")
            .eq("tenant_id", tenantA)
            .limit(5);
          expect(data ?? [], `${a.label} read ${table}`).toEqual([]);
        }
      }
    });

    it("unfiltered reads never include business A's rows", async () => {
      for (const a of attackers) {
        for (const table of [...TARGETS.map((t) => t.table), ...LOG_TABLES]) {
          const { data } = await a.client.from(table).select("tenant_id").limit(1000);
          const leaked = (data ?? []).filter(
            (r: { tenant_id: string }) => r.tenant_id === tenantA,
          );
          expect(leaked, `${a.label} unfiltered ${table}`).toEqual([]);
        }
      }
    });

    it("cannot change business A's records", async () => {
      for (const [label, table, a, t] of attackerCases()) {
        const { data } = await a.client
          .from(table)
          .update(t.update)
          .eq(t.idColumn, t.id(seeded, tenantA))
          .select(t.idColumn);
        expect(data ?? [], `${label} update ${table}`).toEqual([]);
      }
      // Re-read as A's owner: nothing changed.
      const member = await ownerA
        .from("staff_members")
        .select("name")
        .eq("id", seeded.memberId)
        .single();
      expect(member.data?.name).toBe(`${RUN_TAG} worker`);
      const period = await ownerA
        .from("shift_periods")
        .select("title")
        .eq("id", seeded.periodId)
        .single();
      expect(period.data?.title).toBe(`${RUN_TAG} list`);
      const shift = await ownerA
        .from("shifts")
        .select("code")
        .eq("id", seeded.shiftId)
        .single();
      expect(shift.data?.code ?? null).not.toBe("X");
      const contact = await ownerA
        .from("staff_member_contacts")
        .select("phone")
        .eq("staff_member_id", seeded.memberId)
        .single();
      expect(contact.data?.phone).toBe("+358000000");
      const req = await ownerA
        .from("site_access_change_requests")
        .select("status")
        .eq("id", seeded.requestId)
        .single();
      expect(req.data?.status).toBe("open");
    });

    it("cannot move business A's worker to another location", async () => {
      for (const a of attackers) {
        const { data } = await a.client
          .from("staff_members")
          .update({ site_ids: [seeded.siteId] })
          .eq("id", seeded.memberId)
          .select("id");
        expect(data ?? [], a.label).toEqual([]);
      }
      const { data } = await ownerA
        .from("staff_members")
        .select("site_ids")
        .eq("id", seeded.memberId)
        .single();
      expect(data?.site_ids ?? []).toEqual([]);
    });

    it("cannot delete business A's records", async () => {
      for (const [label, table, a, t] of attackerCases()) {
        const { data } = await a.client
          .from(table)
          .delete()
          .eq(t.idColumn, t.id(seeded, tenantA))
          .select(t.idColumn);
        expect(data ?? [], `${label} delete ${table}`).toEqual([]);
      }
      for (const t of TARGETS) {
        const { data } = await ownerA
          .from(t.table)
          .select(t.idColumn)
          .eq(t.idColumn, t.id(seeded, tenantA));
        expect(data?.length, `${t.table} still exists`).toBe(1);
      }
    });

    it("cannot create records inside business A", async () => {
      for (const [label, table, a, t] of attackerCases()) {
        const { data, error } = await a.client
          .from(table)
          .insert(t.forge(seeded, tenantA))
          .select("tenant_id");
        expect(data ?? [], `${label} insert ${table}`).toEqual([]);
        expect(error, `${label} insert ${table} should be rejected`).not.toBeNull();
      }
      const forgedMembers = await ownerA
        .from("staff_members")
        .select("id")
        .eq("tenant_id", tenantA)
        .eq("name", `${RUN_TAG} forged`);
      expect(forgedMembers.data ?? []).toEqual([]);
    });

    it("cannot give itself sign-in access to business A's location", async () => {
      for (const a of attackers) {
        const { data: me } = await a.client.auth.getUser();
        const { data, error } = await a.client
          .from("site_users")
          .insert({ tenant_id: tenantA, site_id: seeded.siteId, user_id: me.user!.id })
          .select("id");
        expect(data ?? [], a.label).toEqual([]);
        expect(error, a.label).not.toBeNull();
      }
    });
  },
);
