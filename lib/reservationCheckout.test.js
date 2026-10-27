import { beforeEach, describe, expect, it, vi } from "vitest";
import { calendarMonthPeriod, monthlyPeriod } from "./monthlyReservation";
import { businessTime } from "./businessTime";
import { decodeReservation, fulfillReservation, reservationMetadata, validateCheckoutPeriods } from "./reservationCheckout";

const { client } = vi.hoisted(() => ({ client: { query: vi.fn(), release: vi.fn() } }));
vi.mock("./db", () => ({ getPool: () => ({ connect: async () => client }) }));

const now = businessTime("2026-10-15T12:00:00");
const periods = [
  { start: "2026-10-20T06:00:00", end: "2026-10-20T09:00:00" },
];
const session = { id: "cs_test_reservation", payment_status: "paid", amount_total: 3000,
  metadata: reservationMetadata("equipment", 1, 18, periods) };

describe("monthly rentals", () => {
  it.each([
    ["2026-10-16", "2026-11-16"], ["2026-01-31", "2026-02-28"],
    ["2028-01-31", "2028-02-29"], ["2026-12-31", "2027-01-31"],
  ])("calculates %s through %s", (start, end) => {
    expect(monthlyPeriod(start)).toEqual({ start: `${start}T00:00:00`, end: `${end}T00:00:00` });
  });
  it("rejects invalid dates and altered monthly ends", () => {
    expect(() => monthlyPeriod("2026-02-30")).toThrow();
    expect(() => validateCheckoutPeriods("rooms", [{ start: "2026-10-20T00:00:00", end: "2026-10-21T00:00:00" }], now)).toThrow();
  });
  it("accepts a monthly rental crossing a daylight saving change", () => {
    expect(validateCheckoutPeriods("rooms", [monthlyPeriod("2026-10-20")], now)).toHaveLength(1);
  });
  it("validates and round trips multiple consecutive calendar months", () => {
    const months = [calendarMonthPeriod("2026-11", 3)];
    expect(validateCheckoutPeriods("rooms", months, now)).toEqual(months);
    const roomSession = { ...session, metadata: reservationMetadata("rooms", 4, 18, months) };
    expect(decodeReservation(roomSession)).toEqual({ type: "rooms", resourceId: 4, userId: 18, periods: months });
    expect(Object.values(roomSession.metadata).every(value => value.length <= 500)).toBe(true);
  });
});

describe("reservation validation", () => {
  it("validates three consecutive selected hours as one persisted period and counts all charged hours", () => {
    const validated = validateCheckoutPeriods("equipment", periods, now);
    expect(validated).toEqual(periods);
    expect(validated.reduce((total, period) => total + (businessTime(period.end) - businessTime(period.start)) / 3600000, 0)).toBe(3);
  });
  it("rejects duplicate, overlapping, malformed, past and out-of-window periods", () => {
    for (const input of [[periods[0], periods[0]], [{ start: "2026-10-20T06:00:00", end: "2026-10-20T06:00:00" }], [null], [{ start: "2026-12-20T06:00:00", end: "2026-12-20T07:00:00" }]]) {
      expect(() => validateCheckoutPeriods("equipment", input, now)).toThrow();
    }
    expect(() => validateCheckoutPeriods("equipment", periods, businessTime("2026-10-21T00:00:00"))).toThrow();
  });
  it("round trips all periods within Stripe metadata size limits", () => {
    const metadata = session.metadata;
    expect(Object.keys(metadata).length).toBeLessThanOrEqual(50);
    expect(Object.values(metadata).every(v => v.length <= 500)).toBe(true);
    expect(decodeReservation(session)).toEqual({ type: "equipment", resourceId: 1, userId: 18, periods });
  });
});

describe("payment fulfillment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });
  it("does not create unpaid bookings", async () => {
    await fulfillReservation({ ...session, payment_status: "unpaid" });
    expect(client.query).not.toHaveBeenCalled();
  });
  it("creates one booking for three consecutive hours and one ledger entry in one transaction", async () => {
    await fulfillReservation(session);
    const calls = client.query.mock.calls;
    expect(calls.filter(([sql]) => sql.includes('INSERT INTO "machine_booking"'))).toHaveLength(1);
    expect(calls.find(([sql]) => sql.includes('INSERT INTO "machine_booking"'))[1]).toEqual([18, 1, periods[0].start, periods[0].end, session.id]);
    expect(calls.find(([sql]) => sql.includes('INSERT INTO "payment"'))[1]).toEqual([18, 30, session.id]);
    expect(calls.at(-1)[0]).toBe("COMMIT");
    expect(calls.some(([sql]) => sql.includes("pg_advisory_xact_lock"))).toBe(true);
  });
  it("ignores retried events even after the machine bookings were canceled", async () => {
    client.query.mockImplementation(async sql => ({ rows: [], rowCount: sql.includes('FROM "payment"') ? 1 : 0 }));
    await fulfillReservation(session);
    expect(client.query.mock.calls.some(([sql]) => sql.includes("INSERT"))).toBe(false);
  });
  it("rolls back booking and payment together when persistence fails", async () => {
    client.query.mockImplementation(async sql => { if (sql.includes('INSERT INTO "payment"')) throw Error("database unavailable"); return { rowCount: 0 }; });
    await expect(fulfillReservation(session)).rejects.toThrow("database unavailable");
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });
});
