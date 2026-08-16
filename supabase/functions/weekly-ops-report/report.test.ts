import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildReportCsv,
  normalizeRecipients,
  normalizeWeekday,
  REPORT_DAYS,
  summarizeByDay,
  type ReportRow,
} from "./index.ts";

const row = (over: Partial<ReportRow> = {}): ReportRow => ({
  reservation_type: "restaurant",
  status: "confirmed",
  date: "2026-08-17",
  start_time: "18:00:00",
  end_time: "20:00:00",
  guest_name: "Aino",
  guests_count: 4,
  estimated_guests: null,
  price_eur: 120,
  ...over,
});

Deno.test("summarizeByDay covers every day in the window", () => {
  const days = summarizeByDay("2026-08-17", [row(), row({ date: "2026-08-19", guests_count: 2, price_eur: 40 })]);
  assertEquals(days.length, REPORT_DAYS);
  assertEquals(days[0], { date: "2026-08-17", reservations: 1, guests: 4, revenue: 120 });
  assertEquals(days[1].reservations, 0);
  assertEquals(days[2], { date: "2026-08-19", reservations: 1, guests: 2, revenue: 40 });
});

Deno.test("CSV quotes values and neutralises formula injection", () => {
  const csv = buildReportCsv([row({ guest_name: '=cmd|"/c calc"' })]);
  const lines = csv.split("\n");
  assertEquals(lines.length, 2);
  assertEquals(lines[1].includes('"\'=cmd|""/c calc"""'), true);
});

Deno.test("recipients fall back to the business email and drop junk", () => {
  assertEquals(normalizeRecipients([], "Owner@Example.com"), ["owner@example.com"]);
  assertEquals(normalizeRecipients(["a@b.co", "nope", "a@b.co"]), ["a@b.co"]);
});

Deno.test("weekday setting is clamped", () => {
  assertEquals(normalizeWeekday(0), 0);
  assertEquals(normalizeWeekday(6), 6);
  assertEquals(normalizeWeekday(9), 1);
  assertEquals(normalizeWeekday("x"), 1);
});
