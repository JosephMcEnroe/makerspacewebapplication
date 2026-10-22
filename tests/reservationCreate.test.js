import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "@/pages/api/reservations/create";


const mocks = vi.hoisted(() => ({ query: vi.fn(), transactionQuery: vi.fn(), release: vi.fn(), user: vi.fn(), csrf: vi.fn(), create: vi.fn(), products: vi.fn() }));
vi.mock("@/lib/db", () => ({ query: mocks.query, getPool: () => ({ connect: async () => ({ query: mocks.transactionQuery, release: mocks.release }) }) }));
vi.mock("@/lib/session", () => ({ getSessionUser: mocks.user }));
vi.mock("@/lib/csrf", () => ({ verifyCsrfToken: mocks.csrf }));
vi.mock("@/lib/stripeCatalog", async importOriginal => ({ ...await importOriginal(),
  getStripe: () => ({ checkout: { sessions: { create: mocks.create } } }), loadStripeProducts: mocks.products }));

function response() {
  return { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}
const periods = [
  { start: "2026-10-20T08:00:00", end: "2026-10-20T09:00:00" },
  { start: "2026-10-20T09:15:00", end: "2026-10-20T10:15:00" },
  { start: "2026-10-20T10:30:00", end: "2026-10-20T11:30:00" },
];
const price = { id: "price_server", active: true, type: "one_time", billing_scheme: "per_unit", unit_amount: 1000 };
function request(body = {}) {
  return { method: "POST", headers: { origin: "http://localhost:3000" },
    body: { type: "equipment", resourceId: 7, periods, ...body } };
}

describe("reservation Checkout API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-15T16:00:00Z"));
    mocks.user.mockResolvedValue({ user_id: 18 });
    mocks.csrf.mockReturnValue(true);
    mocks.transactionQuery.mockImplementation(async sql => {
      if (sql.includes('FROM "room"')) return { rows: [{ room_id: 1 }], rowCount: 1 };
      if (sql.includes('INSERT INTO')) return { rows: [{ reservation_id: 42 }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    mocks.create.mockResolvedValue({ url: "https://checkout.stripe.com/test" });
    mocks.products.mockResolvedValue([{ id: "prod_test", active: true, name: "Equipment", metadata: { equipment_id: "small_cnc" }, default_price: price, priceId: price.id }]);
    mocks.query.mockImplementation(async sql => {
      if (sql.includes('FROM "machine"')) return { rows: [{ stripe_key: "small_cnc", status: "available" }] };
      if (sql.includes('FROM "room"')) return { rows: [{ stripe_key: "small_studio" }] };
      if (sql.includes('FROM "users"')) return { rows: [{ email: "member@example.com" }] };
      return { rows: [], rowCount: 0 };
    });
  });

  it("charges three hours using the server price and does not insert bookings before payment", async () => {
    const res = response();
    await handler(request({ priceId: "price_attacker", quantity: 1 }), res);
    expect(res.status).toHaveBeenCalledWith(200);
    const checkout = mocks.create.mock.calls[0][0];
    expect(checkout.line_items).toEqual([{ price: price.id, quantity: 3 }]);
    expect(checkout.metadata).toMatchObject({ user_id: "18", resource_id: "7", period_count: "3" });
    expect(mocks.query.mock.calls.some(([sql]) => sql.includes("INSERT"))).toBe(false);
  });

  it("saves an hourly room reservation directly without Stripe", async () => {
    const res = response();
    mocks.products.mockRejectedValue(Error("Stripe unavailable"));
    await handler(request({ type: "rooms", resourceId: 1, periods: [{ start: "2026-10-20T00:00:00", end: "2026-10-20T01:00:00" }] }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ ok: true, reservationIds: [42] });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.products).not.toHaveBeenCalled();
    const calls = mocks.transactionQuery.mock.calls;
    expect(calls[0][0]).toBe("BEGIN");
    expect(calls[1]).toEqual(["SELECT pg_advisory_xact_lock(hashtext($1), $2)", ["rooms", 1]]);
    expect(calls.find(([sql]) => sql.includes("INSERT"))[1]).toEqual([18, 1, "2026-10-20T00:00:00", "2026-10-20T01:00:00"]);
    expect(calls.at(-1)[0]).toBe("COMMIT");
    expect(mocks.release).toHaveBeenCalled();
  });

  it("rolls back overlapping room bookings", async () => {
    mocks.transactionQuery.mockResolvedValue({ rows: [{}], rowCount: 1 });
    const res = response();
    await handler(request({ type: "rooms", resourceId: 1, periods: [{ start: "2026-10-20T00:00:00", end: "2026-10-20T01:00:00" }] }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(mocks.transactionQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mocks.transactionQuery.mock.calls.some(([sql]) => sql.includes("INSERT"))).toBe(false);
    expect(mocks.release).toHaveBeenCalled();
  });

  it("rejects missing rooms and invalid room slots", async () => {
    mocks.transactionQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    const res = response();
    await handler(request({ type: "rooms", periods: [{ start: "2026-10-20T00:00:00", end: "2026-10-20T01:00:00" }] }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    const invalid = response();
    await handler(request({ type: "rooms", periods }), invalid);
    expect(invalid.status).toHaveBeenCalledWith(400);
  });

  it.each([401, 403, 409, 503])("does not start checkout for rejection %s", async status => {
    if (status === 401) mocks.user.mockResolvedValue(null);
    if (status === 403) mocks.csrf.mockReturnValue(false);
    if (status === 409) mocks.query.mockResolvedValue({ rows: [{ stripe_key: "small_cnc", status: "maintenance" }], rowCount: 1 });
    if (status === 503) mocks.products.mockResolvedValue([]);
    const res = response();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await handler(request(), res);
    expect(res.status).toHaveBeenCalledWith(status);
    expect(mocks.create).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("rejects existing booking conflicts before creating checkout", async () => {
    mocks.query.mockImplementation(async sql => sql.includes('FROM "machine"')
      ? { rows: [{ stripe_key: "small_cnc", status: "available" }] } : { rows: [{}], rowCount: 1 });
    const res = response();
    await handler(request(), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
