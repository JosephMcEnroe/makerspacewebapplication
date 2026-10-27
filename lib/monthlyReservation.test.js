import { describe, it, expect } from "vitest";
import { calendarMonthPeriod, getMonthlyReservationCount, isMonthlyReservation, monthlyPeriod, monthlyReservationLabel } from "./monthlyReservation";
import { businessTime } from "./businessTime";

describe("monthly studio rental periods", () => {
  it.each([
    ["2026-01", 1, "2026-01-01T00:00:00", "2026-02-01T00:00:00"],
    ["2026-01", 3, "2026-01-01T00:00:00", "2026-04-01T00:00:00"],
    ["2026-11", 3, "2026-11-01T00:00:00", "2027-02-01T00:00:00"],
  ])("builds %s for %i month(s)", (month, count, start, end) => {
    expect(calendarMonthPeriod(month, count)).toEqual({ start, end });
    expect(getMonthlyReservationCount(start, end)).toBe(count);
    expect(isMonthlyReservation(start, end)).toBe(true);
  });

  it("recognizes all calendar months inclusive of the end-exclusive boundary", () => {
    const period = calendarMonthPeriod("2026-01", 3);
    expect(monthlyReservationLabel(period.start, period.end)).toBe("January 2026 – March 2026 (3 months)");
    expect(getMonthlyReservationCount("2026-01-01T00:00:00", "2026-03-31T00:00:00")).toBeNull();
  });

  it("keeps legacy monthly rentals editable and rejects invalid ranges", () => {
    const legacy = monthlyPeriod("2026-01-31");
    expect(getMonthlyReservationCount(legacy.start, legacy.end)).toBe(1);
    expect(isMonthlyReservation(new Date(businessTime(legacy.start)), new Date(businessTime(legacy.end)))).toBe(true);
    expect(() => calendarMonthPeriod("2026-13", 1)).toThrow();
    expect(() => calendarMonthPeriod("2026-01", 13)).toThrow();
    expect(getMonthlyReservationCount("2026-01-01T00:00:00", "2027-02-01T00:00:00")).toBeNull();
  });
});
