import { describe, expect, it } from "vitest";
import { classifyBookingResponse } from "./booking-response";

describe("classifyBookingResponse", () => {
  it("treats a duplicate reply with a null reservation as a duplicate", () => {
    expect(
      classifyBookingResponse({
        success: true,
        duplicate: true,
        reservation: null,
        linked_group_id: null,
        linked_siblings: [],
      }),
    ).toBe("duplicate");
  });

  it("treats a duplicate replay that carries an id as a duplicate", () => {
    expect(classifyBookingResponse({ duplicate: true, reservation: { id: "r1" } })).toBe(
      "duplicate",
    );
  });

  it("treats a normal reply with a reservation id as created", () => {
    expect(classifyBookingResponse({ success: true, reservation: { id: "r1" } })).toBe("created");
  });

  it.each([
    ["null reply", null],
    ["empty object", {}],
    ["null reservation without duplicate flag", { success: true, reservation: null }],
    ["reservation without id", { reservation: {} }],
    ["empty id", { reservation: { id: "" } }],
    ["duplicate flag as string", { duplicate: "true", reservation: null }],
  ])("rejects %s", (_label, data) => {
    expect(classifyBookingResponse(data)).toBe("invalid");
  });
});
