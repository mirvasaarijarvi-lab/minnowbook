import { describe, expect, it } from "vitest";
import { expiresSoon, offerTrackStatus } from "./offer-status";

describe("offerTrackStatus", () => {
  const today = "2026-09-25";
  it("maps stored statuses", () => {
    expect(offerTrackStatus({ status: "confirmed" }, today)).toBe("accepted");
    expect(offerTrackStatus({ status: "declined" }, today)).toBe("declined");
    expect(offerTrackStatus({ status: "sent" }, today)).toBe("pending");
    expect(offerTrackStatus({ status: "draft" }, today)).toBe("draft");
  });
  it("expires open offers past their date, not on the day itself", () => {
    expect(
      offerTrackStatus({ status: "sent", expires_on: "2026-09-24" }, today),
    ).toBe("expired");
    expect(
      offerTrackStatus({ status: "sent", expires_on: "2026-09-25" }, today),
    ).toBe("pending");
  });
  it("never expires accepted or declined offers", () => {
    expect(
      offerTrackStatus(
        { status: "confirmed", expires_on: "2020-01-01" },
        today,
      ),
    ).toBe("accepted");
  });
  it("flags offers expiring soon", () => {
    const now = new Date("2026-09-25T10:00:00Z");
    expect(
      expiresSoon({ status: "sent", expires_on: "2026-09-27" }, 3, now),
    ).toBe(true);
    expect(
      expiresSoon({ status: "sent", expires_on: "2026-10-10" }, 3, now),
    ).toBe(false);
  });
});
