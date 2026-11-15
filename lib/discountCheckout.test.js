import { afterEach, beforeEach, expect, it, vi } from "vitest";
import handler from "../pages/api/reservations/create";
import quoteHandler from "../pages/api/reservations/quote";

const { query, user, create, retrieve } = vi.hoisted(() => ({ query: vi.fn(), user: vi.fn(), create: vi.fn(), retrieve: vi.fn() }));
vi.mock("./db", () => ({ query, getPool: vi.fn() }));
vi.mock("./session", () => ({ getSessionUser: user, WAIVER_REQUIRED: {} }));
vi.mock("./csrf", () => ({ verifyCsrfToken: () => true }));
vi.mock("./stripeCatalog", async importOriginal => {
  const original = await importOriginal();
  return { ...original, getStripe: () => ({ coupons: { retrieve }, checkout: { sessions: { create } } }),
    loadStripeProducts: async () => [{ id: "prod_hour", name: "Machine", priceId: "price_hour", currency: "usd", metadata: { equipment_id: "laser" },
      default_price: { active: true, type: "one_time", billing_scheme: "per_unit", unit_amount: 1200, currency: "usd" } }] };
});
const periods = [{ start: "2026-11-20T09:00:00", end: "2026-11-20T10:00:00" }];
const rental = { name: "Harkonnen", type: "small maker studio", start_date: "2026-11-01T00:00:00", end_date: "2026-12-01T00:00:00", status: "upcoming" };
const request = () => ({ method: "POST", headers: { origin: "http://localhost:3000" }, body: { type: "equipment", resourceId: 1, periods, coupon: "studio_equipment_discount", isStudent: true, total: 0 } });
const response = () => ({ setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn(), end: vi.fn() });
afterEach(() => vi.useRealTimers());

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
  vi.clearAllMocks();
  user.mockResolvedValue({ user_id: 18, waiver_status: true, status: "ACTIVE", role_of_membership: "STUDENT" });
  query.mockImplementation(async sql => {
    if (sql.includes('FROM "machine"')) return { rows: [{ stripe_key: "laser", status: "available" }], rowCount: 1 };
    if (sql.includes('SELECT email')) return { rows: [{ email: "member@example.com" }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
  retrieve.mockImplementation(async id => ({ id, valid: true, percent_off: id === "student_discount" ? 30 : 100, duration: "forever", amount_off: null }));
  create.mockResolvedValue({ url: "https://checkout.stripe.com/test" });
});

it("applies the student coupon server-side to the original Stripe price", async () => {
  const res = response();
  await handler(request(), res);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ discounts: [{ coupon: "student_discount" }], line_items: [{ price: "price_hour", quantity: 1 }] }));
});

it("allows equipment checkout beyond the current membership period", async () => {
  user.mockResolvedValue({ user_id: 18, status: "ACTIVE", period_end_date: "2026-11-15", waiver_status: true });
  const res = response();
  await handler(request(), res);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(create).toHaveBeenCalled();
});

it("quotes the same student discount without creating checkout", async () => {
  const res = response();
  await quoteHandler(request(), res);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ subtotal: 1200, discountAmount: 360, total: 840 }));
  expect(create).not.toHaveBeenCalled();
});

it("ignores client-supplied discounts and totals for an ordinary member", async () => {
  user.mockResolvedValue({ user_id: 18, waiver_status: true, status: "ACTIVE", role_of_membership: "MEMBER" });
  await handler(request(), response());
  expect(create.mock.calls[0][0].discounts).toBeUndefined();
  expect(retrieve).not.toHaveBeenCalled();
});

it("uses the studio coupon for covered equipment regardless of student status", async () => {
  const original = query.getMockImplementation();
  query.mockImplementation(async (sql, args) => sql.includes('FROM "room_reservation" rr') ? { rows: [rental], rowCount: 1 } : original(sql, args));
  await handler(request(), response());
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ discounts: [{ coupon: "studio_equipment_discount" }], customer_creation: "always" }));
});

it("returns a configuration error instead of charging full price when a coupon is missing", async () => {
  retrieve.mockRejectedValue(new Error("Missing coupon"));
  const res = response();
  const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await handler(request(), res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(create).not.toHaveBeenCalled();
  } finally { errorLog.mockRestore(); }
});

it("requires sign-in for personalized quotes", async () => {
  user.mockResolvedValue(null);
  const res = response();
  await quoteHandler(request(), res);
  expect(res.status).toHaveBeenCalledWith(401);
});
