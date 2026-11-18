import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import book from "../pages/api/staff/reservations/index";
import status from "../pages/api/staff/reservations/checkout-status";
import { createReservationCheckout } from "./reservationBookingCheckout";
import { calendarMonthPeriod } from "./monthlyReservation";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  csrf: vi.fn(),
  query: vi.fn(),
  client: { query: vi.fn(), release: vi.fn() },
  create: vi.fn(),
  retrieve: vi.fn(),
  direct: vi.fn(),
  enroll: vi.fn(),
  discount: vi.fn(),
}));

vi.mock("@/lib/staffAuth", () => ({ requireStaffApi: mocks.session }));
vi.mock("@/lib/csrf", () => ({ verifyCsrfToken: mocks.csrf }));
vi.mock("@/lib/db", () => ({ query: mocks.query, getPool: () => ({ connect: async () => mocks.client }) }));
vi.mock("@/Data_Access_Layer/UserRepository", () => ({
  UserRepository: class { async findById(id) { return { user_id: id, email: "member@example.com" }; } },
}));
vi.mock("@/Data_Access_Layer/MembershipRepository", () => ({
  membershipRepositry: class { async findUserMembership() { return { role_of_membership: "STUDENT" }; } },
}));
vi.mock("@/lib/reservationService", () => ({
  createResourceReservations: mocks.direct, enrollUserInClass: mocks.enroll,
}));
vi.mock("@/lib/discounts", () => ({ resolveDiscount: mocks.discount }));
vi.mock("@/lib/stripeCatalog", async (importOriginal) => ({
  ...await importOriginal(),
  getStripe: () => ({ checkout: { sessions: { create: mocks.create, retrieve: mocks.retrieve } } }),
  loadStripeProducts: async () => {
    const default_price = { active: true, type: "one_time", billing_scheme: "per_unit", unit_amount: 1000, currency: "usd" };
    return [
      { id: "prod_machine", priceId: "price_machine", metadata: { equipment_id: "machine" }, default_price },
      { id: "prod_studio", priceId: "price_studio", metadata: { room_id: "studio" }, default_price },
    ];
  },
}));

const equipment = [{ start: "2026-11-20T09:00:00", end: "2026-11-20T11:00:00" }];

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn(), setHeader: vi.fn() };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-17T12:00:00Z"));
  vi.stubEnv("APP_URL", "https://booking.example.com");
  vi.stubEnv("STRIPE_SECRET_KEY", "test-placeholder");
  mocks.session.mockResolvedValue({ user: { user_id: 3 } });
  mocks.csrf.mockReturnValue(true);
  mocks.create.mockResolvedValue({ url: "https://checkout.stripe.com/test" });
  mocks.query.mockResolvedValue({ rows: [], rowCount: 0 });
  mocks.client.query.mockResolvedValue({ rows: [], rowCount: 0 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("staff reservation Checkout", () => {
  it("uses the member identity, discount and server-side pricing for equipment", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ stripe_key: "machine", status: "available" }] });
    mocks.discount.mockResolvedValue({ couponId: "student_coupon" });
    const res = response();
    await book({ method: "POST", body: { userId: 18, type: "equipment", resourceId: 7, periods: equipment } }, res);
    expect(mocks.discount).toHaveBeenCalledWith(expect.objectContaining({
      user: { user_id: 18, email: "member@example.com", role_of_membership: "STUDENT" },
      productId: "prod_machine",
    }));
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      customer_email: "member@example.com",
      client_reference_id: "18",
      metadata: expect.objectContaining({ user_id: "18", staff_user_id: "3", reservation_type: "equipment" }),
      line_items: [{ price: "price_machine", quantity: 2 }],
      discounts: [{ coupon: "student_coupon" }],
      success_url: "https://booking.example.com/staff/reservations/checkout-return?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://booking.example.com/staff/reservations/new?canceled=true&resourceId=7&userId=18&type=equipment",
    }));
    expect(res.json).toHaveBeenCalledWith({ url: "https://checkout.stripe.com/test" });
    expect(mocks.direct).not.toHaveBeenCalled();
  });

  it("starts monthly studio Checkout for an admin", async () => {
    mocks.session.mockResolvedValue({ user: { user_id: 5 }, isAdmin: true });
    mocks.query.mockResolvedValueOnce({ rows: [{ name: "Harkonnen", stripe_key: "studio" }] });
    const res = response();
    await book({ method: "POST", body: { userId: 18, type: "rooms", resourceId: 7,
      periods: [calendarMonthPeriod("2026-12"), calendarMonthPeriod("2027-01")] } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ user_id: "18", staff_user_id: "5", period_count: "2" }),
      line_items: [{ price: "price_studio", quantity: 2 }],
    }));
    expect(mocks.client.query).toHaveBeenCalledWith("COMMIT");
  });

  it("keeps hourly room reservations and classes on the direct path", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ name: "Conference Room" }] });
    mocks.direct.mockResolvedValue({ status: 201, body: { ok: true } });
    mocks.enroll.mockResolvedValue({ status: 201, body: { ok: true } });
    const periods = [{ start: "2026-11-20T08:45:00", end: "2026-11-20T09:45:00" }];
    await book({ method: "POST", body: { userId: 18, type: "rooms", resourceId: 7, periods } }, response());
    await book({ method: "POST", body: { userId: 18, type: "classes", resourceId: 7 } }, response());
    expect(mocks.direct).toHaveBeenCalledWith({ userId: 18, type: "rooms", resourceId: 7, periods });
    expect(mocks.enroll).toHaveBeenCalledWith({ userId: 18, classId: 7 });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("keeps member self-service on the member return screen", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ stripe_key: "machine", status: "available" }] });
    const result = await createReservationCheckout({
      user: { user_id: 18, email: "member@example.com" }, type: "equipment", resourceId: 7, periods: equipment,
    });
    expect(result.status).toBe(200);
    const [session] = mocks.create.mock.calls[0];
    expect(session.metadata).not.toHaveProperty("staff_user_id");
    expect(session.success_url).toContain("/reservations/checkout-return");
    expect(session.success_url).not.toContain("/staff/");
  });

  it("restricts staff status to the initiator and waits for the selected member's booking", async () => {
    const req = { method: "GET", query: { session_id: "cs_test_staff" } };
    mocks.retrieve.mockResolvedValue({ id: "cs_test_staff", status: "complete", payment_status: "no_payment_required",
      metadata: { purchase_type: "reservation", reservation_type: "equipment", staff_user_id: "3", user_id: "18" } });
    mocks.session.mockResolvedValueOnce(null).mockResolvedValueOnce({ user: { user_id: 4 } });
    await status(req, response());
    expect(mocks.retrieve).not.toHaveBeenCalled();
    const denied = response();
    await status(req, denied);
    expect(denied.status).toHaveBeenCalledWith(404);
    expect(mocks.query).not.toHaveBeenCalled();
    const pending = response();
    await status(req, pending);
    expect(pending.json).toHaveBeenCalledWith(expect.objectContaining({ status: "processing", memberId: 18 }));
    expect(mocks.query).toHaveBeenCalledWith(expect.any(String), ["cs_test_staff", 18]);
    mocks.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 10,
      start_time: equipment[0].start, end_time: equipment[0].end,
    }] });
    const confirmed = response();
    await status(req, confirmed);
    expect(confirmed.json).toHaveBeenCalledWith(expect.objectContaining({ status: "confirmed", reservationIds: [10] }));
  });
});
