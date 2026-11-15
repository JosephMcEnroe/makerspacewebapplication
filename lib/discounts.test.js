import { beforeEach, describe, expect, it, vi } from "vitest";
import { businessTime } from "./businessTime";
import { couponApplies, discountedProduct, hasStudioCoverage, isStudent, loadDiscountCoupon, priceQuote, resolveDiscount, studioCoversPeriods, STUDENT_COUPON, STUDIO_COUPON } from "./discounts";

const { db, retrieve } = vi.hoisted(() => ({ db: vi.fn(), retrieve: vi.fn() }));
vi.mock("./db", () => ({ query: db }));
vi.mock("./stripeCatalog", () => ({ getStripe: () => ({ coupons: { retrieve } }) }));
const rental = { name: "Harkonnen", type: "small maker studio", status: "upcoming", start_date: "2026-11-01T00:00:00", end_date: "2026-12-01T00:00:00" };
const periods = [{ start: "2026-11-20T09:00:00", end: "2026-11-20T10:00:00" }];
const student = { user_id: 18, role_of_membership: "STUDENT" };
const coupon = { id: STUDENT_COUPON, valid: true, percent_off: 30, amount_off: null, duration: "forever" };

beforeEach(() => {
  vi.clearAllMocks();
  db.mockResolvedValue({ rows: [] });
  retrieve.mockImplementation(async id => id === STUDENT_COUPON ? coupon : { ...coupon, id, percent_off: 100, applies_to: { products: ["prod_hour"] } });
});

describe("studio eligibility", () => {
  it("covers future rentals independent of today's date", () => expect(studioCoversPeriods([rental], periods)).toBe(true));
  it("handles database dates in Eastern time across DST", () => {
    const row = { ...rental, start_date: new Date(businessTime(rental.start_date)), end_date: new Date(businessTime(rental.end_date)) };
    expect(studioCoversPeriods([row], [{ start: "2026-11-01T00:00:00", end: "2026-11-01T01:00:00" }])).toBe(true);
  });
  it("allows an end exactly at the rental boundary but not a start there", () => {
    expect(studioCoversPeriods([rental], [{ start: "2026-11-30T23:00:00", end: rental.end_date }])).toBe(true);
    expect(studioCoversPeriods([rental], [{ start: rental.end_date, end: "2026-12-01T01:00:00" }])).toBe(false);
  });
  it("requires every selected period to be covered", () => {
    expect(studioCoversPeriods([rental], [...periods, { start: "2026-12-02T10:00:00", end: "2026-12-02T11:00:00" }])).toBe(false);
  });
  it("merges adjacent rental windows but never a gap", () => {
    const december = { ...rental, start_date: rental.end_date, end_date: "2027-01-01T00:00:00" };
    const crossing = [{ start: "2026-11-30T23:00:00", end: "2026-12-01T01:00:00" }];
    expect(studioCoversPeriods([december, rental], crossing)).toBe(true);
    expect(studioCoversPeriods([{ ...december, start_date: "2027-01-01T00:00:00", end_date: "2027-02-01T00:00:00" }, rental], crossing)).toBe(false);
  });
  it.each([
    { ...rental, status: "Cancelled" },
    { ...rental, name: "Meeting Room", type: "meeting" },
    { ...rental, end_date: "2026-11-01T01:00:00" },
  ])("excludes canceled, non-studio and hourly bookings", row => expect(studioCoversPeriods([row], periods)).toBe(false));
  it("includes staff-created rentals without a Stripe session", async () => {
    db.mockResolvedValue({ rows: [rental] });
    expect(await hasStudioCoverage(18, periods)).toBe(true);
    expect(db.mock.calls[0][1]).toEqual([18]);
  });
  it("does not qualify an empty selection", () => expect(studioCoversPeriods([rental], [])).toBe(false));
});

describe("coupon policy", () => {
  it("uses the stored student role", () => {
    expect(isStudent({ role_of_membership: " student " })).toBe(true);
    expect(isStudent({ role_of_membership: "MEMBER", student: true })).toBe(false);
  });
  it("gives free equipment precedence over student pricing", async () => {
    db.mockResolvedValue({ rows: [rental] });
    expect(await resolveDiscount({ user: student, type: "equipment", periods, productId: "prod_hour" })).toMatchObject({ couponId: STUDIO_COUPON, percentOff: 100 });
    expect(retrieve).toHaveBeenCalledTimes(1);
  });
  it("falls back to student pricing for mixed dates", async () => {
    db.mockResolvedValue({ rows: [rental] });
    expect(await resolveDiscount({ user: student, type: "equipment", periods: [...periods, { start: "2026-12-02T09:00:00", end: "2026-12-02T10:00:00" }], productId: "prod_hour" })).toMatchObject({ couponId: STUDENT_COUPON });
  });
  it("charges standard prices for other accounts without coverage", async () => {
    expect(await resolveDiscount({ user: { user_id: 1 }, type: "equipment", periods, productId: "prod_hour" })).toBeNull();
    expect(retrieve).not.toHaveBeenCalled();
  });
  it.each(["rooms", "membership", undefined])("applies student pricing to %s without checking studios", async type => {
    expect(await resolveDiscount({ user: student, type, productId: "prod_any" })).toMatchObject({ couponId: STUDENT_COUPON });
    expect(db).not.toHaveBeenCalled();
  });
  it.each([
    { ...coupon, valid: false }, { ...coupon, deleted: true }, { ...coupon, percent_off: 0 },
    { ...coupon, percent_off: null }, { ...coupon, percent_off: 101 },
    { ...coupon, applies_to: { products: ["prod_one"] } },
  ])("fails clearly for invalid student coupon configuration", async value => {
    retrieve.mockResolvedValue(value);
    await expect(loadDiscountCoupon(STUDENT_COUPON)).rejects.toMatchObject({ status: 503 });
  });
  it("fails clearly for a missing coupon or a restricted equipment product", async () => {
    retrieve.mockRejectedValueOnce(new Error("No such coupon"));
    await expect(loadDiscountCoupon(STUDENT_COUPON)).rejects.toMatchObject({ status: 503 });
    db.mockResolvedValue({ rows: [rental] });
    await expect(resolveDiscount({ user: student, type: "equipment", periods, productId: "prod_wrong" })).rejects.toMatchObject({ status: 503 });
  });
  it.each([30, 50, 99, 100, 12.5])("uses Stripe's configured student percentage %s for prices and labels", async percent => {
    const configured = { ...coupon, percent_off: percent };
    retrieve.mockResolvedValue(configured);
    const discount = await resolveDiscount({ user: student, productId: "prod_any" });
    expect(discount).toMatchObject({ percentOff: percent, label: `Student: ${percent}% off` });
    const product = discountedProduct({ id: "prod_any", default_price: { unit_amount: 1200 }, currency: "usd" }, configured);
    expect(product.priceAmount).toBe(1200 - Math.round(1200 * percent / 100));
    expect(product.discountLabel).toBe(`Student: ${percent}% off`);
  });
  it("still requires the studio equipment coupon to grant 100% off", async () => {
    retrieve.mockResolvedValue({ ...coupon, id: STUDIO_COUPON, percent_off: 99 });
    await expect(loadDiscountCoupon(STUDIO_COUPON)).rejects.toMatchObject({ status: 503 });
  });
  it("accepts once coupons for one-time purchases but requires forever for ongoing student subscriptions", async () => {
    retrieve.mockResolvedValue({ ...coupon, duration: "once" });
    expect(await resolveDiscount({ user: student, productId: "prod_any" })).toMatchObject({ percentOff: 30 });
    await expect(resolveDiscount({ user: student, productId: "prod_any", subscription: true })).rejects.toMatchObject({ status: 503 });
  });
  it("rounds the total discount in cents while preserving Stripe base prices", () => {
    const product = { id: "prod_any", default_price: { unit_amount: 999 }, priceAmountFormatted: 9.99, currency: "usd" };
    expect(priceQuote(999, 3, "usd", { percentOff: 30 })).toMatchObject({ subtotal: 2997, discountAmount: 899, total: 2098 });
    const discounted = discountedProduct(product, coupon);
    expect(discounted.priceAmountFormatted).toBe(6.99);
    expect(discounted.default_price.unit_amount).toBe(999);
    expect(product.priceAmountFormatted).toBe(9.99);
    expect(couponApplies({ applies_to: { products: ["other"] } }, product.id)).toBe(false);
  });
});
