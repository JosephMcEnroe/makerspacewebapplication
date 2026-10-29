import { describe, it, expect, vi } from "vitest";
import { allocateCents, buildFinancialReport } from "./stripeFinancialReport";

const list = items => (async function* () { for (const item of items) yield item; })();
const period = { start: "2026-10-01", end: "2026-10-28", startSeconds: 1, endSeconds: 100, timezone: "America/New_York", generatedAt: "2026-10-28T12:00:00Z" };
const mappings = { machines: [{ machine_id: 1, type: "Small CNC", stripe_machine_id: "small_cnc" }], rooms: [{ room_id: 1, type: "Small Studio", stripe_room_id: "small_studio" }] };
function transaction(id, amount, fee = 0, type = "charge", source = "ch_1", currency = "usd") {
  return { id, amount, fee, net: amount - fee, type, reporting_category: type, source, currency, created: 50 };
}
function fixture(transactions) {
  return {
    balanceTransactions: { list: vi.fn(() => list(transactions)) },
    charges: { retrieve: vi.fn(async value => ({ id: value, payment_intent: `pi_${value}` })) },
    checkout: { sessions: {
      list: vi.fn(() => list([{ id: "cs_1", metadata: {} }])),
      listLineItems: vi.fn(() => list([{ amount_total: 1200, amount_discount: 100, amount_tax: 0, currency: "usd", quantity: 1,
        price: { product: { id: "prod_1", name: "Small CNC", metadata: { equipment_id: "small_cnc" } } } }])),
    } },
    refunds: { retrieve: vi.fn(async () => ({ charge: "ch_1" })) },
    disputes: { retrieve: vi.fn(async () => ({ charge: "ch_1" })) },
    invoicePayments: { list: vi.fn(() => list([{ invoice: "in_1" }])) },
    invoices: { listLineItems: vi.fn(() => list([{ amount: 9500, currency: "usd", quantity: 1,
      pricing: { price_details: { product: "prod_membership" } } }])) },
    products: { retrieve: vi.fn(async () => ({ id: "prod_membership", name: "Monthly membership", metadata: { membership_type: "monthly" } })) },
  };
}
const build = stripe => buildFinancialReport({ stripe, mappings, period, mode: "test" });
describe("Stripe financial ledger", () => {
  it("reconciles refunds, disputes, attached and standalone fees, payouts and duplicate references", async () => {
    const payment = transaction("txn_1", 1200, 65);
    const stripe = fixture([payment, payment, transaction("txn_2", -300, 0, "refund", "re_1"),
      transaction("txn_3", -100, 15, "dispute", "dp_1"), transaction("txn_4", -20, 0, "stripe_fee", null),
      transaction("txn_5", -500, 0, "payout", "po_1"), transaction("txn_6", 10, 0, "adjustment", null)]);
    const report = await build(stripe), s = report.currencies[0];
    expect(s.totals).toEqual({ revenue: 1200, collected: 1200, refunds: -300, disputes: -100, fees: 100, other: 10,
      netPaymentActivity: 710, payouts: -500, balanceChange: 210 });
    expect(s.sales[0]).toMatchObject({ group: "Machine reservations", type: "Small CNC", quantity: 1, collected: 1200, refunds: -300, disputes: -100 });
    expect(stripe.charges.retrieve).toHaveBeenCalledTimes(1);
    expect(s.transactions).toHaveLength(6);
    expect(s.machines).toEqual([{ type: "Small CNC", reservations: 1, hours: 1, fee: -80, net: 720 }]);
  });
  it("paginates asynchronously beyond 100 ledger rows", async () => {
    const stripe = fixture(Array.from({ length: 105 }, (_, i) => transaction(`txn_${i}`, 1200)));
    const report = await build(stripe);
    expect(report.currencies[0].totals.collected).toBe(126000);
    expect(report.currencies[0].machines[0]).toMatchObject({ reservations: 1, hours: 105 });
    expect(stripe.balanceTransactions.list).toHaveBeenCalledWith({ limit: 100, created: { gte: 1, lt: 100 } });
  });
  it("uses invoice payments for membership renewals without checkout", async () => {
    const stripe = fixture([transaction("txn_1", 9500)]);
    stripe.checkout.sessions.list.mockImplementation(() => list([]));
    const report = await build(stripe);
    expect(report.currencies[0].sales[0]).toMatchObject({ group: "Memberships", collected: 9500, quantity: 1 });
    expect(stripe.invoicePayments.list).toHaveBeenCalledWith(expect.objectContaining({ payment: { type: "payment_intent", payment_intent: "pi_ch_1" } }));
  });
  it("allocates mixed purchases exactly and groups studios", async () => {
    const stripe = fixture([transaction("txn_1", 999)]);
    stripe.checkout.sessions.listLineItems.mockImplementation(() => list([
      { amount_total: 500, quantity: 1, currency: "usd", price: { product: { id: "prod_1", name: "CNC", metadata: { equipment_id: "small_cnc" } } } },
      { amount_total: 500, quantity: 1, currency: "usd", price: { product: { id: "prod_2", name: "Studio", metadata: { room_id: "small_studio" } } } },
    ]));
    const report = await build(stripe);
    expect(report.currencies[0].sales.map(r => r.collected)).toEqual([500, 499]);
    expect(allocateCents(-1001, [1, 1])).toEqual([-501, -500]);
  });
  it("keeps excess payment amounts separate without inflating units", async () => {
    const report = await build(fixture([transaction("txn_1", 1300)]));
    expect(report.currencies[0].sales.map(r => r.collected)).toEqual([1200, 100]);
    expect(report.currencies[0].sales[0].quantity).toBe(1);
    expect(report.currencies[0].sales[1].type).toBe("Unresolved difference");
  });
  it("allocates mixed-purchase fees to machine types and counts distinct checkouts", async () => {
    const stripe = fixture([transaction("txn_1", 1000, 65), transaction("txn_2", 1000, 65, "charge", "ch_2")]);
    stripe.checkout.sessions.list.mockImplementation(({ payment_intent }) => list([{ id: `cs_${payment_intent}`, metadata: {} }]));
    stripe.checkout.sessions.listLineItems.mockImplementation(() => list([
      { amount_total: 500, quantity: 2, currency: "usd", price: { product: { id: "prod_1", name: "CNC", metadata: { equipment_id: "small_cnc" } } } },
      { amount_total: 500, quantity: 1, currency: "usd", price: { product: { id: "prod_2", name: "Studio", metadata: { room_id: "small_studio" } } } },
    ]));
    const report = await build(stripe);
    expect(report.currencies[0].machines).toEqual([{ type: "Small CNC", reservations: 2, hours: 4, fee: -66, net: 934 }]);
  });
  it("recognizes adjustment-type failed refunds and standalone fee categories", async () => {
    const failed = transaction("txn_1", 300, 0, "adjustment", "re_1"); failed.reporting_category = "refund_failure";
    const fee = transaction("txn_2", -20, 0, "adjustment", null); fee.reporting_category = "fee";
    const report = await build(fixture([failed, fee]));
    expect(report.currencies[0].totals).toMatchObject({ refunds: 300, fees: 20, other: 0, netPaymentActivity: 280 });
  });
  it("normalizes invoice discounts and exclusive taxes before allocating payments", async () => {
    const stripe = fixture([transaction("txn_1", 9720)]);
    stripe.checkout.sessions.list.mockImplementation(() => list([]));
    stripe.invoices.listLineItems.mockImplementation(() => list([{ subtotal: 10000, amount: 10000, currency: "usd", quantity: 1,
      discount_amounts: [{ amount: 1000 }], taxes: [{ amount: 720, tax_behavior: "exclusive" }],
      pricing: { price_details: { product: "prod_membership" } } }]));
    const s = (await build(stripe)).currencies[0];
    expect(s.sales[0]).toMatchObject({ quantity: 1, collected: 9720 });
    expect(s.discounts).toBe(1000); expect(s.taxes).toBe(720);
    expect(s.totals.revenue).toBe(9000);
  });
  it("retains unknown sales and separates currencies", async () => {
    const stripe = fixture([transaction("txn_1", 1200), transaction("txn_2", 500, 0, "charge", "ch_2", "eur")]);
    stripe.checkout.sessions.listLineItems.mockImplementation(() => list([]));
    const report = await build(stripe);
    expect(report.currencies).toHaveLength(2);
    expect(report.currencies[0].sales[0].group).toBe("Uncategorized");
    expect(report.warnings.length).toBeGreaterThan(0);
  });
  it("fails the report when required enrichment fails", async () => {
    const stripe = fixture([transaction("txn_1", 1200)]);
    stripe.charges.retrieve.mockRejectedValue(new Error("Stripe unavailable"));
    await expect(build(stripe)).rejects.toThrow("Stripe unavailable");
  });
  it("returns a usable empty report", async () => {
    expect((await build(fixture([]))).currencies[0].totals.balanceChange).toBe(0);
  });
  it("includes every database machine type once even with no activity", async () => {
    const report = await buildFinancialReport({ stripe: fixture([]), period, mode: "test", mappings: {
      ...mappings, machines: [...mappings.machines, { type: "Laser" }, { type: "Laser" }, { type: "3D printer" }],
    } });
    expect(report.currencies[0].machines).toEqual(["3D printer", "Laser", "Small CNC"].map(type => ({
      type, reservations: 0, hours: 0, fee: 0, net: 0,
    })));
  });
});
