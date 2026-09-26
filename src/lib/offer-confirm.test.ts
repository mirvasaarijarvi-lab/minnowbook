import { describe, expect, it, vi } from "vitest";
import { offerHasStaffActions, writeOfferMainReservation } from "./offer-confirm";

const TODAY = "2026-09-26";
const PAST = "2026-09-20";

describe("offerHasStaffActions (regression: expired offers keep actions)", () => {
  it.each(["draft", "sent"])(
    "keeps Send, Confirm and Mark declined for an expired %s offer",
    (status) => {
      expect(
        offerHasStaffActions({ status, expires_on: PAST }, TODAY),
      ).toBe(true);
    },
  );

  it("keeps actions for a guest-accepted offer past its expiry", () => {
    expect(
      offerHasStaffActions(
        { status: "sent", expires_on: PAST, guest_accepted_at: PAST } as any,
        TODAY,
      ),
    ).toBe(true);
  });

  it("keeps actions for open offers that have not expired", () => {
    expect(offerHasStaffActions({ status: "sent", expires_on: "2026-10-01" }, TODAY)).toBe(true);
    expect(offerHasStaffActions({ status: "draft" }, TODAY)).toBe(true);
  });

  it.each(["confirmed", "declined", "expired"])(
    "hides actions for a closed %s offer",
    (status) => {
      expect(offerHasStaffActions({ status, expires_on: PAST }, TODAY)).toBe(false);
    },
  );

  it("hides actions for archived offers", () => {
    expect(
      offerHasStaffActions({ status: "sent", archived_at: PAST }, TODAY),
    ).toBe(false);
  });
});

function fakeDb(existing: Record<string, any> | null = null) {
  const inserts: any[] = [];
  const updates: any[] = [];
  const db = {
    from: vi.fn(() => ({
      insert(row: any) {
        inserts.push(row);
        return {
          select: () => ({
            single: async () => ({ data: { id: "res-new", ...row }, error: null }),
          }),
        };
      },
      update(row: any) {
        updates.push(row);
        const chain: any = {
          eq: () => chain,
          select: () => chain,
          maybeSingle: async () => ({
            data: existing ? { ...existing, ...row } : null,
            error: null,
          }),
        };
        return chain;
      },
    })),
  };
  return { db, inserts, updates };
}

const acceptedOffer = {
  tenant_id: "t1",
  event_date: "2026-10-10",
  start_time: "18:00",
  end_time: "22:00",
  guest_name: "Guest",
  guest_email: "g@example.com",
  guests_count: 20,
  event_space: "Hall",
  language: "fi",
  status: "sent",
  expires_on: PAST,
  guest_accepted_at: PAST,
};

describe("writeOfferMainReservation (regression: confirming a guest-accepted offer)", () => {
  it("creates a confirmed reservation for an expired guest-accepted offer", async () => {
    expect(offerHasStaffActions(acceptedOffer, TODAY)).toBe(true);
    const { db, inserts } = fakeDb();
    const res = await writeOfferMainReservation(db, acceptedOffer, {
      mainType: "venue",
      resourceId: "r1",
      price: 500,
      linkedGroupId: "g1",
    });
    expect(res.id).toBe("res-new");
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      tenant_id: "t1",
      status: "confirmed",
      reservation_type: "venue",
      date: "2026-10-10",
      start_time: "18:00:00",
      end_time: "22:00:00",
      guests_count: 20,
      resource_id: "r1",
      price_eur: 500,
      linked_group_id: "g1",
    });
  });

  it("turns the originating public booking into the reservation instead of adding one", async () => {
    const { db, inserts, updates } = fakeDb({ id: "res-public" });
    const res = await writeOfferMainReservation(
      db,
      { ...acceptedOffer, source_reservation_id: "res-public" },
      { mainType: "venue", resourceId: null, price: null, linkedGroupId: "g1" },
    );
    expect(res.id).toBe("res-public");
    expect(inserts).toHaveLength(0);
    expect(updates[0]).toMatchObject({ status: "confirmed" });
    expect(updates[0]).not.toHaveProperty("tenant_id");
    expect(updates[0]).not.toHaveProperty("price_eur");
  });

  it("falls back to creating a reservation when the public booking is gone", async () => {
    const { db, inserts } = fakeDb(null);
    const res = await writeOfferMainReservation(
      db,
      { ...acceptedOffer, source_reservation_id: "missing" },
      { mainType: "venue", resourceId: null, price: null, linkedGroupId: "g1" },
    );
    expect(res.id).toBe("res-new");
    expect(inserts).toHaveLength(1);
  });
});
