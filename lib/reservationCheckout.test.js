import { beforeEach, describe, expect, it, vi } from "vitest";
import { monthlyPeriod } from "./monthlyReservation";
import { businessTime } from "./businessTime";
import { REFUNDED_PAYMENT_METHOD, decodeReservation, fulfillReservation, reservationMetadata, validateCheckoutPeriods } from "./reservationCheckout";

const { client, refund } = vi.hoisted(() => ({ client: { query: vi.fn(), release: vi.fn() }, refund: vi.fn() }));
vi.mock("./db", () => ({ getPool: () => ({ connect: async () => client }) }));
vi.mock("./stripeCatalog", () => ({ getStripe: () => ({ refunds: { create: refund } }) }));

const now = businessTime("2026-10-15T12:00:00");
const periods = [
  { start: "2026-10-20T08:00:00", end: "2026-10-20T09:00:00" },
  { start: "2026-10-20T09:15:00", end: "2026-10-20T10:15:00" },
  { start: "2026-10-20T10:30:00", end: "2026-10-20T11:30:00" },
];
const session = { id: "cs_test_reservation", payment_status: "paid", amount_total: 3000, payment_intent: "pi_test",
  metadata: reservationMetadata("equipment", 1, 18, periods) };

// The machine exists; pass `conflict: true` to make another booking overlap the paid times.
function database({ machine = true, conflict = false } = {}) {
  return async sql => {
    if (sql.includes('FROM "machine"')) return { rows: [], rowCount: machine ? 1 : 0 };
    if (conflict && sql.includes('FROM "machine_booking"') && sql.includes("INTERVAL")) return { rows: [{}], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  };
}
const inserts = table => client.query.mock.calls.filter(([sql]) => sql.includes(`INSERT INTO "${table}"`));

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
});

describe("reservation validation", () => {
  it("accepts three separate purchased hours", () => expect(validateCheckoutPeriods("equipment", periods, now)).toHaveLength(3));
  it("rejects duplicate, overlapping, malformed, past and out-of-window periods", () => {
    for (const input of [[periods[0], periods[0]], [{ start: "2026-10-20T08:00:00", end: "2026-10-20T11:00:00" }], [null], [{ start: "2026-12-20T08:00:00", end: "2026-12-20T09:00:00" }]]) {
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
    client.query.mockImplementation(database());
    refund.mockResolvedValue({ id: "re_test" });
  });
  it("does not create unpaid bookings", async () => {
    await fulfillReservation({ ...session, payment_status: "unpaid" });
    expect(client.query).not.toHaveBeenCalled();
  });
  it("creates three bookings and one ledger entry in one transaction", async () => {
    await fulfillReservation(session);
    const calls = client.query.mock.calls;
    expect(inserts("machine_booking")).toHaveLength(3);
    expect(inserts("payment")[0][1]).toEqual([18, 30, "stripe", session.id]);
    expect(calls.at(-1)[0]).toBe("COMMIT");
    expect(calls).toContainEqual(["SELECT pg_advisory_xact_lock(hashtext($1), $2)", ["equipment", 1]]);
    expect(refund).not.toHaveBeenCalled();
  });
  it("refunds instead of double-booking when the times were taken during checkout", async () => {
    client.query.mockImplementation(database({ conflict: true }));
    await fulfillReservation(session);
    expect(inserts("machine_booking")).toHaveLength(0);
    expect(refund).toHaveBeenCalledWith({ payment_intent: "pi_test" }, { idempotencyKey: `reservation-refund-${session.id}` });
    expect(inserts("payment")[0][1]).toEqual([18, 0, REFUNDED_PAYMENT_METHOD, session.id]);
    expect(client.query.mock.calls.at(-1)[0]).toBe("COMMIT");
  });
  it("refunds when the machine no longer exists", async () => {
    client.query.mockImplementation(database({ machine: false }));
    await fulfillReservation(session);
    expect(inserts("machine_booking")).toHaveLength(0);
    expect(refund).toHaveBeenCalledTimes(1);
  });
  it("rolls back so Stripe retries when the refund itself fails", async () => {
    client.query.mockImplementation(database({ conflict: true }));
    refund.mockRejectedValue(Error("Stripe unavailable"));
    await expect(fulfillReservation(session)).rejects.toThrow("Stripe unavailable");
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(inserts("payment")).toHaveLength(0);
  });
  it("refunds and acknowledges checkouts with unreadable metadata instead of failing forever", async () => {
    await expect(fulfillReservation({ ...session, metadata: { purchase_type: "reservation" } })).resolves.toBeUndefined();
    expect(refund).toHaveBeenCalledTimes(1);
    expect(client.query).not.toHaveBeenCalled();
  });
  it("ignores retried events even after the machine bookings were canceled", async () => {
    client.query.mockImplementation(async sql => ({ rows: [], rowCount: sql.includes('FROM "payment"') ? 1 : 0 }));
    await fulfillReservation(session);
    expect(client.query.mock.calls.some(([sql]) => sql.includes("INSERT"))).toBe(false);
  });
  it("rolls back booking and payment together when persistence fails", async () => {
    const available = database();
    client.query.mockImplementation(async sql => { if (sql.includes('INSERT INTO "payment"')) throw Error("database unavailable"); return available(sql); });
    await expect(fulfillReservation(session)).rejects.toThrow("database unavailable");
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });
});
