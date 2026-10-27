import { describe, expect, it } from "vitest";
import { groupRoomReservations, mergeRoomReservationPeriods } from "./reservationGrouping";

const slots = [
  { reservation_id: 1, user_id: 7, room_id: 2, start_date: "2026-10-20T00:00:00", end_date: "2026-10-20T01:00:00", status: "upcoming" },
  { reservation_id: 2, user_id: 7, room_id: 2, start_date: "2026-10-20T01:15:00", end_date: "2026-10-20T02:15:00", status: "upcoming" },
  { reservation_id: 3, user_id: 7, room_id: 2, start_date: "2026-10-20T02:30:00", end_date: "2026-10-20T03:30:00", status: "upcoming" },
];

describe("groupRoomReservations", () => {
  it("treats consecutive room slots separated by 15-minute buffers as one logical reservation", () => {
    const [group] = groupRoomReservations([...slots].reverse());
    expect(group.reservation_id).toBe(1);
    expect(group.reservation_ids).toEqual([1, 2, 3]);
    expect(group.start_date).toBe(slots[0].start_date);
    expect(group.end_date).toBe(slots[2].end_date);
  });

  it.each([
    ["a gap longer than 15 minutes", { start_date: "2026-10-20T01:16:00" }],
    ["overlapping slots", { start_date: "2026-10-20T00:45:00" }],
    ["a different room", { room_id: 3 }],
    ["a different member", { user_id: 8 }],
    ["a different status", { status: "cancelled" }],
  ])("starts a separate reservation for %s", (_description, change) => {
    const next = { ...slots[1], reservation_id: 4, ...change };
    const groups = groupRoomReservations([slots[0], next]);
    expect(groups).toHaveLength(2);
  });

  it("persists the 12 AM, 1:15 AM, and 2:30 AM selections as one continuous period", () => {
    expect(mergeRoomReservationPeriods(slots.map(({ start_date, end_date }) => ({ start: start_date, end: end_date })))).toEqual([
      { start: "2026-10-20T00:00:00", end: "2026-10-20T03:30:00" },
    ]);
  });

  it("does not combine non-hourly legacy room reservations", () => {
    const groups = groupRoomReservations([
      slots[0],
      { ...slots[1], start_date: "2026-10-20T01:15:00", end_date: "2026-10-20T03:15:00" },
    ]);
    expect(groups).toHaveLength(2);
  });
});
