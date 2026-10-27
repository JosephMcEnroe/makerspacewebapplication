import { describe, it, expect } from "vitest";
import { calendarMonthPeriod, getCalendarMonthSelection, getMonthlyReservationCount, getMonthlyStartAvailability, isMonthlyReservation, mergeCalendarMonthPeriods, monthlyPeriod, monthlyReservationLabel, monthlyReservationSelectionLabel, ROOM_BOOKING_ADVANCE_DAYS } from "./monthlyReservation";
import { businessTime } from "./businessTime";
import { validateCheckoutPeriods } from "./reservationCheckout";

describe("monthly studio rental periods", () => {
  it("allows room bookings up to one year in advance", () => {
    expect(ROOM_BOOKING_ADVANCE_DAYS).toBe(365);
    const bookingWindowStart = businessTime("2026-10-01T00:00:00");
    const oneYearAway = businessTime("2027-10-01T00:00:00");
    expect(oneYearAway - bookingWindowStart).toBe(365 * 86400000);
    expect(() => validateCheckoutPeriods("rooms", [calendarMonthPeriod("2027-10", 1)], bookingWindowStart)).not.toThrow();
    expect(() => validateCheckoutPeriods("rooms", [calendarMonthPeriod("2027-10", 1)], bookingWindowStart - 1)).toThrow();
  });
  it.each([
    ["2026-01", 1, "2026-01-01T00:00:00", "2026-02-01T00:00:00"],
    ["2026-01", 3, "2026-01-01T00:00:00", "2026-04-01T00:00:00"],
    ["2026-11", 3, "2026-11-01T00:00:00", "2027-02-01T00:00:00"],
  ])("builds %s for %i month(s)", (month, count, start, end) => {
    expect(calendarMonthPeriod(month, count)).toEqual({ start, end });
    expect(getMonthlyReservationCount(start, end)).toBe(count);
    expect(isMonthlyReservation(start, end)).toBe(true);
  });

  it("normalizes a user-selected set of unique months, including separated selections", () => {
    const selected = [calendarMonthPeriod("2026-11"), calendarMonthPeriod("2027-01"), calendarMonthPeriod("2026-12")];
    expect(getCalendarMonthSelection(selected)).toMatchObject({ count: 3 });
    expect(mergeCalendarMonthPeriods(selected).periods).toEqual([calendarMonthPeriod("2026-11"), calendarMonthPeriod("2026-12"), calendarMonthPeriod("2027-01")]);
    expect(monthlyReservationSelectionLabel(["2026-11", "2027-01", "2026-12"])).toBe("November 2026, December 2026, January 2027 (3 months)");
    expect(getCalendarMonthSelection([selected[0], selected[0]])).toBeNull();
    expect(getCalendarMonthSelection([...selected, ...Array.from({ length: 10 }, (_, index) => calendarMonthPeriod(`2027-${String(index + 2).padStart(2, "0")}`))])).toBeNull();
  });

  it("lists start months as available only when the full rental term is clear", () => {
    const months = getMonthlyStartAvailability("2026-10", "2027-01", 2, [
      { reservationId: 1, start: "2026-11-01T00:00:00", end: "2026-12-01T00:00:00" },
    ]);
    expect(months).toEqual([
      { month: "2026-10", available: false, status: "reserved" },
      { month: "2026-11", available: false, status: "reserved" },
      { month: "2026-12", available: true, status: "available" },
      { month: "2027-01", available: true, status: "available" },
    ]);
    expect(getMonthlyStartAvailability("2026-10", "2026-10", 1, [
      { reservationId: 7, start: "2026-10-01T00:00:00", end: "2026-11-01T00:00:00" },
    ], 7)[0].available).toBe(true);
    expect(getMonthlyStartAvailability("2026-10", "2027-09", 1, [], null, "2026-12").map(({ status }) => status)).toEqual([
      "available", "available", "available", "outsideWindow", "outsideWindow", "outsideWindow",
      "outsideWindow", "outsideWindow", "outsideWindow", "outsideWindow", "outsideWindow", "outsideWindow",
    ]);
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
