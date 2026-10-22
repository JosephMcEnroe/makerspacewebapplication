import { describe, expect, it } from "vitest";
import {
  buildReservationPeriods,
  getReservationSlotStartMinutes,
  hasReservationBuffer,
  isAllowedReservationStart,
  isUnavailableInterval,
  isValidReservationPeriod,
  toggleReservationSlot,
} from "./reservationPeriods";
import { businessTime } from "./businessTime";

describe("reservation slot schedule", () => {
  it("starts each room slot 75 minutes after the prior one and ends with 10:30–11:30 PM", () => {
    const starts = getReservationSlotStartMinutes("rooms");
    expect(starts.slice(0, 4)).toEqual([0, 75, 150, 225]);
    expect(starts.at(-1)).toBe(22 * 60 + 30);
    expect(starts.slice(-2)).toEqual([21 * 60 + 15, 22 * 60 + 30]);
    expect(isAllowedReservationStart("rooms", "2026-10-20T22:30:00")).toBe(true);
    expect(isAllowedReservationStart("rooms", "2026-10-20T22:00:00")).toBe(false);
  });

  it("uses the same 15-minute cadence for equipment within its booking window", () => {
    expect(getReservationSlotStartMinutes("equipment").slice(0, 4)).toEqual([480, 555, 630, 705]);
    expect(getReservationSlotStartMinutes("equipment").at(-1)).toBe(22 * 60 + 30);
  });

  it("builds one-hour periods from minute-based slots, including the final slot", () => {
    expect(buildReservationPeriods([
      { date: "2026-10-20", startMinute: 22 * 60 + 30 },
      { date: "2026-10-20", startMinute: 75 },
    ])).toEqual([
      { date: "2026-10-20", startMinute: 75, endDate: "2026-10-20", endMinute: 135 },
      { date: "2026-10-20", startMinute: 22 * 60 + 30, endDate: "2026-10-20", endMinute: 23 * 60 + 30 },
    ]);
  });

  it("validates exact one-hour approved slot times", () => {
    expect(isValidReservationPeriod("rooms", { start: "2026-10-20T00:00:00", end: "2026-10-20T01:00:00" })).toBe(true);
    expect(isValidReservationPeriod("rooms", { start: "2026-10-20T01:00:00", end: "2026-10-20T02:00:00" })).toBe(false);
    expect(isValidReservationPeriod("rooms", { start: "2026-10-20T22:30:00", end: "2026-10-20T23:30:00" })).toBe(true);
    expect(isValidReservationPeriod("rooms", { start: "2026-10-20T22:30:00", end: "2026-10-21T00:30:00" })).toBe(false);
  });

  it("requires a 15-minute buffer between submitted reservation periods", () => {
    expect(hasReservationBuffer([
      { start: "2026-10-20T00:00:00", end: "2026-10-20T01:00:00" },
      { start: "2026-10-20T01:15:00", end: "2026-10-20T02:15:00" },
    ])).toBe(true);
    expect(hasReservationBuffer([
      { start: "2026-10-20T00:00:00", end: "2026-10-20T01:00:00" },
      { start: "2026-10-20T01:14:00", end: "2026-10-20T02:14:00" },
    ])).toBe(false);
  });
});

describe("buildReservationPeriods", () => {
  it("keeps separate slots as separate one-hour reservation periods", () => {
    expect(buildReservationPeriods([
      { date: "2026-10-20", startMinute: 14 * 60 + 15 },
      { date: "2026-10-20", startMinute: 13 * 60 },
    ])).toEqual([
      { date: "2026-10-20", startMinute: 13 * 60, endDate: "2026-10-20", endMinute: 14 * 60 },
      { date: "2026-10-20", startMinute: 14 * 60 + 15, endDate: "2026-10-20", endMinute: 15 * 60 + 15 },
    ]);
  });

  it("allows selected slots to be removed and available slots to be added", () => {
    const chosenSlot = { date: "2026-10-20", startMinute: 13 * 60 };
    const anotherSlot = { date: "2026-10-20", startMinute: 15 * 60 + 15 };
    const slots = [chosenSlot];

    expect(toggleReservationSlot(slots, chosenSlot, false)).toEqual([]);
    expect(toggleReservationSlot(slots, anotherSlot, true)).toEqual([chosenSlot, anotherSlot]);
    expect(toggleReservationSlot(slots, anotherSlot, false)).toBe(slots);
  });

  it("ignores the reservation being edited but keeps other conflicts", () => {
    const ownReservation = { reservationId: 7, start: "2026-10-20T13:00:00", end: "2026-10-20T14:00:00" };
    const otherReservation = { reservationId: 8, start: "2026-10-20T13:00:00", end: "2026-10-20T14:00:00" };
    const start = businessTime("2026-10-20T13:00:00");
    const end = businessTime("2026-10-20T14:00:00");

    expect(isUnavailableInterval(ownReservation, 7, start, end)).toBe(false);
    expect(isUnavailableInterval(otherReservation, 7, start, end)).toBe(true);
  });

  it("allows exactly 15 minutes between a reservation and the next slot", () => {
    const reservation = { start: "2026-10-20T13:00:00", end: "2026-10-20T14:00:00" };
    const bufferedStart = businessTime("2026-10-20T14:15:00");
    const bufferedEnd = businessTime("2026-10-20T15:15:00");
    expect(isUnavailableInterval(reservation, null, bufferedStart, bufferedEnd)).toBe(false);
  });
});
