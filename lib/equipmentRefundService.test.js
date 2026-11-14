import { beforeEach, describe, expect, it, vi } from "vitest";
import { businessTime } from "./businessTime";
import { equipmentCancellation, handleEquipmentRefundEvent, processEquipmentRefund } from "./equipmentRefundService";

const { client, stripe } = vi.hoisted(() => ({
  client: { query: vi.fn(), release: vi.fn() },
  stripe: { refunds: { list: vi.fn(), create: vi.fn(), retrieve: vi.fn() } },
}));
vi.mock("./db", () => ({ getPool: () => ({ connect: async () => client, query: (...args) => client.query(...args) }) }));
vi.mock("./stripeCatalog", () => ({ getStripe: () => stripe }));

const booking = { booking_id: 42, user_id: 8, booking_active: true, refund_eligible: true,
  start_date_time: "2026-11-20T10:00:00", end_date_time: "2026-11-20T13:00:00",
  paid_amount: "60.00", payment_id: 5, stripe_payment_intent_id: "pi_test" };
const request = { refund_id: 9, booking_id: 42, payment_id: 5, amount: "60.00", payment_amount: "100.00",
  stripe_payment_intent_id: "pi_test", stripe_refund_id: null, status: "queued" };
const refund = { id: "re_test", amount: 6000, currency: "usd", payment_intent: "pi_test", status: "succeeded",
  metadata: { equipment_refund_id: "9" } };
let current, saved;
function mockDb(sql) {
  if (sql.includes("FROM machine_booking b")) return { rows: current ? [current] : [], rowCount: current ? 1 : 0 };
  if (sql.includes("INSERT INTO equipment_refund")) return { rows: [{ refund_id: 9 }], rowCount: 1 };
  if (sql.includes("SELECT payment_id FROM equipment_refund")) return { rows: [{ payment_id: 5 }] };
  if (sql.includes("FROM equipment_refund r JOIN payment")) return { rows: [saved] };
  return { rows: [], rowCount: 0 };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_unit_tests_only");
  vi.spyOn(Date, "now").mockReturnValue(businessTime("2026-11-18T10:00:00"));
  current = { ...booking }; saved = { ...request };
  client.query.mockImplementation(async sql => mockDb(sql));
  stripe.refunds.list.mockReturnValue((async function* () {})());
  stripe.refunds.create.mockResolvedValue(refund);
  stripe.refunds.retrieve.mockResolvedValue(refund);
});

describe("cancellation acceptance", () => {
  const args = { userId: 8, actorId: 12, reservationId: 42 };
  it("requires a valid preview and commits cancellation/refund before provider submission", async () => {
    const preview = await equipmentCancellation({ ...args, preview: true });
    expect(client.query.mock.calls.some(([sql]) => sql.includes("INSERT"))).toBe(false);
    expect((await equipmentCancellation({ ...args, quote: preview.body.preview.quote })).status).toBe(200);
    const calls = client.query.mock.calls;
    const update = calls.find(([sql]) => sql.includes("UPDATE machine_booking"));
    expect(update[1][3]).toBe(12);
    expect(calls.find(([sql]) => sql.includes("INSERT INTO equipment_refund"))[1]).toEqual([42, 5, "60.00", "queued"]);
    expect(client.query.mock.invocationCallOrder[calls.findIndex(([sql]) => sql === "COMMIT")]).toBeLessThan(stripe.refunds.create.mock.invocationCallOrder[0]);
    expect(stripe.refunds.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 6000, payment_intent: "pi_test" }), { idempotencyKey: "equipment-refund-9" });
  });
  it("requires reconfirmation after a deadline passes or after an edit", async () => {
    Date.now.mockReturnValue(businessTime("2026-11-19T10:00:00"));
    const quote = (await equipmentCancellation({ ...args, preview: true })).body.preview.quote;
    Date.now.mockReturnValue(businessTime("2026-11-19T10:00:01"));
    expect(await equipmentCancellation({ ...args, quote })).toMatchObject({ status: 409, body: { preview: { refundAmount: "40.00" } } });
    current.refund_eligible = false;
    expect((await equipmentCancellation({ ...args, quote })).status).toBe(409);
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });
  it("rejects tampered, missing, or different-actor quotes", async () => {
    const quote = (await equipmentCancellation({ ...args, preview: true })).body.preview.quote;
    for (const data of [{ quote: `${quote}x` }, {}, { quote, actorId: 99 }]) {
      expect((await equipmentCancellation({ ...args, ...data })).status).toBe(409);
    }
  });
  it("does not create another refund for an already cancelled booking", async () => {
    current.booking_active = false;
    expect((await equipmentCancellation(args)).body.cancelled).toBe(true);
    expect(client.query.mock.calls.some(([sql]) => sql.includes("INSERT"))).toBe(false);
  });
  it("cancels unpaid bookings without inserting an invalid payment foreign key", async () => {
    current.payment_id = null; current.paid_amount = null;
    const quote = (await equipmentCancellation({ ...args, preview: true })).body.preview.quote;
    expect((await equipmentCancellation({ ...args, quote })).status).toBe(200);
    expect(client.query.mock.calls.some(([sql]) => sql.includes("INSERT INTO equipment_refund"))).toBe(false);
  });
  it("rolls back cancellation if its durable refund record cannot be saved", async () => {
    const quote = (await equipmentCancellation({ ...args, preview: true })).body.preview.quote;
    client.query.mockImplementation(async sql => { if (sql.includes("INSERT INTO equipment_refund")) throw new Error("db failure"); return mockDb(sql); });
    expect((await equipmentCancellation({ ...args, quote })).status).toBe(500);
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });
});

describe("refund recovery", () => {
  it("finds a previously submitted refund by metadata instead of issuing it again", async () => {
    stripe.refunds.list.mockReturnValue((async function* () { yield refund; })());
    await processEquipmentRefund(9);
    expect(stripe.refunds.create).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("SET stripe_refund_id"), [9, "re_test", "succeeded"]);
  });
  it("leaves uncertain submissions queued for reconciliation", async () => {
    stripe.refunds.create.mockRejectedValue(new Error("timeout"));
    await expect(processEquipmentRefund(9)).rejects.toThrow("timeout");
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.query.mock.calls.some(([sql]) => sql.includes("status = 'failed'"))).toBe(false);
  });
  it("stops for review if a Dashboard refund has no per-booking allocation", async () => {
    stripe.refunds.list.mockReturnValue((async function* () { yield { ...refund, id: "re_dashboard", metadata: {} }; })());
    await processEquipmentRefund(9);
    expect(stripe.refunds.create).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledWith("UPDATE equipment_refund SET status = 'failed' WHERE refund_id = $1", [9]);
  });
  it("retrieves current state rather than trusting an out-of-order webhook", async () => {
    saved.stripe_refund_id = "re_test"; saved.status = "pending";
    client.query.mockImplementation(async sql => sql.includes("refund_id::text") ? { rows: [{ refund_id: 9 }] } : mockDb(sql));
    await handleEquipmentRefundEvent({ ...refund, status: "pending" });
    expect(stripe.refunds.retrieve).toHaveBeenCalledWith("re_test");
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("SET stripe_refund_id"), [9, "re_test", "succeeded"]);
  });
});
