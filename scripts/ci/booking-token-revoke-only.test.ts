import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "drizzle/migrations/0054_booking_token_revoke_only_updates.sql",
  "utf8",
);

describe("guest booking links are revoke-only for members", () => {
  it("members may update only the revoked flag", () => {
    expect(sql).toMatch(
      /REVOKE UPDATE ON public\.booking_tokens FROM authenticated/,
    );
    expect(sql).toMatch(
      /GRANT UPDATE \(is_revoked\) ON public\.booking_tokens TO authenticated;/,
    );
  });
  it("a disabled link cannot be switched back on and its booking cannot change", () => {
    expect(sql).toMatch(
      /NEW\.reservation_id IS DISTINCT FROM OLD\.reservation_id/,
    );
    expect(sql).toMatch(
      /OLD\.is_revoked = true AND NEW\.is_revoked IS DISTINCT FROM true/,
    );
  });
});
