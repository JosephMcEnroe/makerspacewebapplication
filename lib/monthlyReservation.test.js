import { describe, it, expect } from "vitest";
import { monthlyPeriod, isMonthlyReservation } from "./monthlyReservation";
import { businessTime } from "./businessTime";

describe("monthly booking recognition", () => {
  it.each(["2026-10-20", "2026-01-31", "2028-01-31", "2026-12-31"])("recognizes %s without a Stripe session", date => {
    const { start, end } = monthlyPeriod(date);
    expect(isMonthlyReservation(start, end)).toBe(true);
    expect(isMonthlyReservation(new Date(businessTime(start)), new Date(businessTime(end)))).toBe(true);
  });
  it("keeps legacy hourly bookings separate and rejects invalid dates", () => {
    expect(isMonthlyReservation("2026-10-20T08:00:00", "2026-10-20T09:00:00")).toBe(false);
    expect(isMonthlyReservation("invalid", null)).toBe(false);
  });
});
