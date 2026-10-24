import { describe, expect, it } from "vitest";
import {
  buildReservationPeriods,
  countEquipmentReservationHours,
  getReservationSlotStartMinutes,
  hasReservationBuffer,
  isAllowedReservationStart,
  isUnavailableInterval,
  isValidEquipmentReservation,
  isValidReservationPeriod,
  mergeAdjacentReservationPeriods,
  reservationCustomerEnd,
  reservationCustomerEndDateTime,
  toggleReservationSlot,
} from "./reservationPeriods";
import { businessTime } from "./businessTime";
import { formatTimeRange } from "./format";

describe("reservation slot schedule", () => {
  it("starts each room slot 75 minutes after the prior one and ends with 10:30–11:30 PM", () => {
    const starts = getReservationSlotStartMinutes("rooms");
    expect(starts.slice(0, 4)).toEqual([0, 75, 150, 225]);
    expect(starts.at(-1)).toBe(22 * 60 + 30);
    expect(starts.slice(-2)).toEqual([21 * 60 + 15, 22 * 60 + 30]);
    expect(isAllowedReservationStart("rooms", "2026-10-20T22:30:00")).toBe(true);
    expect(isAllowedReservationStart("rooms", "2026-10-20T22:00:00")).toBe(false);
  });

  it("offers machine slots every hour from 6 AM through the 10 PM–11 PM slot", () => {
    const starts = getReservationSlotStartMinutes("equipment");
    expect(starts).toEqual(Array.from({ length: 17 }, (_, index) => (6 + index) * 60));
    expect(isAllowedReservationStart("equipment", "2026-10-20T06:00:00")).toBe(true);
    expect(isAllowedReservationStart("equipment", "2026-10-20T22:00:00")).toBe(true);
    expect(isAllowedReservationStart("equipment", "2026-10-20T23:00:00")).toBe(false);
  });

  it("reduces the customer-facing machine end time by 15 minutes, including across midnight", () => {
    expect(reservationCustomerEnd("2026-10-20T07:00:00")).toEqual({ date: "2026-10-20", time: "6:45 AM" });
    expect(reservationCustomerEnd("2026-10-21T00:00:00")).toEqual({ date: "2026-10-20", time: "11:45 PM" });
    expect(reservationCustomerEnd("2026-10-20T06:45:00")).toEqual({ date: "2026-10-20", time: "6:30 AM" });
    expect(reservationCustomerEndDateTime("2026-10-20T09:00:00")).toBe("2026-10-20T08:45:00");
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

  it("validates exact room hours and continuous machine reservations separately", () => {
    expect(isValidReservationPeriod("equipment", { start: "2026-10-20T06:00:00", end: "2026-10-20T07:00:00" })).toBe(true);
    expect(isValidReservationPeriod("equipment", { start: "2026-10-20T06:00:00", end: "2026-10-20T07:15:00" })).toBe(false);
    expect(isValidReservationPeriod("equipment", { start: "2026-10-20T22:00:00", end: "2026-10-20T23:00:00" })).toBe(true);
    expect(isValidReservationPeriod("rooms", { start: "2026-10-20T00:00:00", end: "2026-10-20T01:00:00" })).toBe(true);
    expect(isValidReservationPeriod("rooms", { start: "2026-10-20T01:00:00", end: "2026-10-20T02:00:00" })).toBe(false);
    expect(isValidReservationPeriod("rooms", { start: "2026-10-20T22:30:00", end: "2026-10-20T23:30:00" })).toBe(true);
    expect(isValidReservationPeriod("rooms", { start: "2026-10-20T22:30:00", end: "2026-10-21T00:30:00" })).toBe(false);
  });

  it("merges adjacent equipment slots into one continuous period but keeps gaps separate", () => {
    const merged = buildReservationPeriods([
      { date: "2026-10-20", startMinute: 8 * 60 },
      { date: "2026-10-20", startMinute: 6 * 60 },
      { date: "2026-10-20", startMinute: 7 * 60 },
      { date: "2026-10-20", startMinute: 10 * 60 },
    ], { mergeAdjacent: true });
    expect(merged).toEqual([
      { date: "2026-10-20", startMinute: 6 * 60, endDate: "2026-10-20", endMinute: 9 * 60 },
      { date: "2026-10-20", startMinute: 10 * 60, endDate: "2026-10-20", endMinute: 11 * 60 },
    ]);
    const first = `${merged[0].date}T${String(Math.floor(merged[0].startMinute / 60)).padStart(2, "0")}:00:00`;
    const last = `${merged[0].endDate}T${String(Math.floor(merged[0].endMinute / 60)).padStart(2, "0")}:00:00`;
    expect(`${first.slice(11, 16)}–${reservationCustomerEndDateTime(last).slice(11, 16)}`).toBe("06:00–08:45");
    expect(formatTimeRange(first, reservationCustomerEndDateTime(last))).toBe("Oct 20, 2026 6:00 AM - 8:45 AM");
    const acrossMidnight = buildReservationPeriods([
      { date: "2026-10-20", startMinute: 21 * 60 },
      { date: "2026-10-20", startMinute: 22 * 60 },
    ], { mergeAdjacent: true })[0];
    expect(acrossMidnight).toEqual({ date: "2026-10-20", startMinute: 21 * 60, endDate: "2026-10-20", endMinute: 23 * 60 });
  });

  it("merges adjacent persisted equipment periods into one reservation and charges each hour", () => {
    const merged = mergeAdjacentReservationPeriods([
      { start: "2026-10-20T08:00:00", end: "2026-10-20T09:00:00" },
      { start: "2026-10-20T06:00:00", end: "2026-10-20T07:00:00" },
      { start: "2026-10-20T07:00:00", end: "2026-10-20T08:00:00" },
    ]);
    expect(merged).toEqual([{ start: "2026-10-20T06:00:00", end: "2026-10-20T09:00:00" }]);
    expect(countEquipmentReservationHours(merged)).toBe(3);
  });

  it("validates continuous machine periods as one reservation up to 11 PM", () => {
    expect(isValidEquipmentReservation("equipment", { start: "2026-10-20T13:00:00", end: "2026-10-20T15:00:00" })).toBe(true);
    expect(isValidEquipmentReservation("equipment", { start: "2026-10-20T13:00:00", end: "2026-10-20T15:15:00" })).toBe(false);
    expect(isValidEquipmentReservation("equipment", { start: "2026-10-20T21:00:00", end: "2026-10-20T23:00:00" })).toBe(true);
    expect(isValidEquipmentReservation("equipment", { start: "2026-10-20T22:00:00", end: "2026-10-20T23:00:00" })).toBe(true);
  });

  it("accepts consecutive machine reservations with no gap and retains room buffers", () => {
    const periods = [
      { start: "2026-10-20T06:00:00", end: "2026-10-20T07:00:00" },
      { start: "2026-10-20T07:00:00", end: "2026-10-20T08:00:00" },
    ];
    expect(hasReservationBuffer(periods, 0)).toBe(true);
    expect(hasReservationBuffer(periods)).toBe(false);
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
