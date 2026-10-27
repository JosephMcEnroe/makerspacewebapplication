import { beforeEach, describe, expect, it, vi } from "vitest";
import { businessTime } from "./businessTime";
import { calendarMonthPeriod } from "./monthlyReservation";
import { cancelUserReservation, createResourceReservations } from "./reservationService";

const mocks = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn() }));
vi.mock("./db", () => ({ getPool: () => ({ connect: async () => ({ query: mocks.query, release: mocks.release }) }) }));

const selectedRoomPeriods = [
  { start: "2026-10-20T00:00:00", end: "2026-10-20T01:00:00" },
  { start: "2026-10-20T01:15:00", end: "2026-10-20T02:15:00" },
  { start: "2026-10-20T02:30:00", end: "2026-10-20T03:30:00" },
];

describe("room reservation grouping", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(businessTime("2026-10-15T12:00:00"));
    mocks.query.mockImplementation(async (sql) => {
      if (sql.includes("INSERT INTO \"room_reservation\"")) return { rows: [{ reservation_id: 25 }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
  });

  it("stores staff-selected 12 AM, 1:15 AM, and 2:30 AM blocks as one 12–3:30 AM row", async () => {
    const result = await createResourceReservations({ userId: 8, type: "rooms", resourceId: 4, periods: selectedRoomPeriods });
    expect(result).toMatchObject({ status: 201, body: { reservationIds: [25] } });
    const insert = mocks.query.mock.calls.find(([sql]) => sql.includes("INSERT INTO \"room_reservation\""));
    expect(insert[1]).toEqual([8, 4, "2026-10-20T00:00:00", "2026-10-20T03:30:00"]);
    expect(mocks.query.mock.calls.filter(([sql]) => sql.includes("INSERT INTO \"room_reservation\"")).length).toBe(1);
  });

  it("allows staff room bookings more than three months in advance", async () => {
    const months = [calendarMonthPeriod("2027-10", 1)];
    mocks.query.mockImplementation(async sql => {
      if (sql.includes('FROM "room"')) return { rows: [{ name: "Harkonnen", type: "small maker studio" }], rowCount: 1 };
      if (sql.includes('INSERT INTO "room_reservation"')) return { rows: [{ reservation_id: 40 }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const result = await createResourceReservations({ userId: 8, type: "rooms", resourceId: 4, periods: months });
    expect(result).toMatchObject({ status: 201, body: { reservationIds: [40] } });
  });

  it("lets staff book a studio for multiple consecutive months without hourly buffers", async () => {
    const months = [calendarMonthPeriod("2026-11", 3)];
    mocks.query.mockImplementation(async sql => {
      if (sql.includes('FROM "room"')) return { rows: [{ name: "Harkonnen", type: "small maker studio" }], rowCount: 1 };
      if (sql.includes('INSERT INTO "room_reservation"')) return { rows: [{ reservation_id: 40 }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const result = await createResourceReservations({ userId: 8, type: "rooms", resourceId: 4, periods: months });
    expect(result).toMatchObject({ status: 201, body: { reservationIds: [40, 40, 40] } });
    expect(mocks.query.mock.calls.find(([sql]) => sql.includes("SELECT 1 FROM \"room_reservation\""))[0]).not.toContain("15 minutes");
    expect(mocks.query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO "room_reservation"')).map(([, values]) => values)).toEqual([
      [8, 4, "2026-11-01T00:00:00", "2026-12-01T00:00:00"],
      [8, 4, "2026-12-01T00:00:00", "2027-01-01T00:00:00"],
      [8, 4, "2027-01-01T00:00:00", "2027-02-01T00:00:00"],
    ]);
  });

  it("staff books only the selected distinct studio months", async () => {
    const months = [calendarMonthPeriod("2026-11"), calendarMonthPeriod("2027-01")];
    mocks.query.mockImplementation(async sql => {
      if (sql.includes('FROM "room"')) return { rows: [{ name: "Harkonnen", type: "small maker studio" }], rowCount: 1 };
      if (sql.includes('INSERT INTO "room_reservation"')) return { rows: [{ reservation_id: 40 }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const result = await createResourceReservations({ userId: 8, type: "rooms", resourceId: 4, periods: months });
    expect(result).toMatchObject({ status: 201, body: { reservationIds: [40, 40] } });
    expect(mocks.query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO "room_reservation"'))).toHaveLength(2);
  });

  it("rejects calendar-month staff rentals for non-studio rooms", async () => {
    mocks.query.mockResolvedValue({ rows: [{ name: "Workshop", type: "Room" }], rowCount: 1 });
    const result = await createResourceReservations({ userId: 8, type: "rooms", resourceId: 4, periods: [calendarMonthPeriod("2026-11")] });
    expect(result.status).toBe(400);
    expect(mocks.query.mock.calls.some(([sql]) => sql.includes("INSERT INTO"))).toBe(false);
  });

  it("cancels all linked room slots in one transaction", async () => {
    mocks.query.mockImplementation(async (sql) => {
      if (sql.includes("UPDATE \"room_reservation\"")) return { rows: [{ reservation_id: 25 }, { reservation_id: 26 }], rowCount: 2 };
      return { rows: [], rowCount: 0 };
    });
    const result = await cancelUserReservation({ userId: 8, type: "room", reservationId: 25, reservationIds: [25, 26] });
    expect(result.status).toBe(200);
    expect(mocks.query).toHaveBeenCalledWith("BEGIN");
    expect(mocks.query.mock.calls.find(([sql]) => sql.includes("UPDATE \"room_reservation\""))[1]).toEqual([[25, 26], 8]);
    expect(mocks.query).toHaveBeenCalledWith("COMMIT");
    expect(mocks.release).toHaveBeenCalled();
  });

  it("rolls back grouped cancellation if one linked slot is missing", async () => {
    mocks.query.mockImplementation(async (sql) => sql.includes("UPDATE \"room_reservation\"")
      ? { rows: [{ reservation_id: 25 }], rowCount: 1 }
      : { rows: [], rowCount: 0 });
    const result = await cancelUserReservation({ userId: 8, type: "room", reservationId: 25, reservationIds: [25, 26] });
    expect(result.status).toBe(404);
    expect(mocks.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mocks.query).not.toHaveBeenCalledWith("COMMIT");
  });
});
