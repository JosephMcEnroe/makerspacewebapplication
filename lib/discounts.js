import { query } from "./db";
import { businessTime } from "./businessTime";
import { isMonthlyReservation } from "./monthlyReservation";
import { isMonthlyStudioResource } from "./resourceGroups";
import { getStripe } from "./stripeCatalog";

export const STUDENT_COUPON = "student_discount";
export const STUDIO_COUPON = "studio_equipment_discount";

export class PricingConfigurationError extends Error {
  constructor() { super("Discount pricing is currently unavailable. Please contact staff."); this.status = 503; }
}

export function isStudent(user) {
  return String(user?.role_of_membership || "").trim().toUpperCase() === "STUDENT";
}

// Cover the entire selection, allowing adjacent rentals but never gaps.
export function studioCoversPeriods(rentals, periods) {
  const intervals = rentals.filter(row => !String(row.status || "").toLowerCase().startsWith("cancel")
    && isMonthlyStudioResource({ name: row.name, description: row.type })
    && isMonthlyReservation(row.start_date, row.end_date))
    .map(row => [businessTime(row.start_date), businessTime(row.end_date)])
    .sort((a, b) => a[0] - b[0]);
  return periods.length > 0 && periods.every(period => {
    let cursor = businessTime(period.start);
    const end = businessTime(period.end);
    if (!Number.isFinite(cursor) || !Number.isFinite(end) || end <= cursor) return false;
    for (const [start, finish] of intervals) {
      if (start > cursor) break;
      if (finish > cursor) cursor = finish;
      if (cursor >= end) return true;
    }
    return false;
  });
}

export async function hasStudioCoverage(userId, periods, db = { query }) {
  const { rows } = await db.query(`SELECT rr.start_date, rr.end_date, rr.status, r.name, r.type
    FROM "room_reservation" rr JOIN "room" r ON r.room_id = rr.room_id
    WHERE rr.user_id = $1 AND (rr.status IS NULL OR LOWER(rr.status) NOT LIKE 'cancel%')`, [userId]);
  return studioCoversPeriods(rows, periods);
}

export async function loadDiscountCoupon(id, stripe = getStripe()) {
  try {
    const coupon = await stripe.coupons.retrieve(id);
    const validPercentage = Number.isFinite(coupon.percent_off) && coupon.percent_off > 0 && coupon.percent_off <= 100;
    if (!coupon.valid || coupon.deleted || !validPercentage || (id === STUDIO_COUPON && coupon.percent_off !== 100) || coupon.amount_off != null
      || (id === STUDENT_COUPON && coupon.applies_to?.products?.length)) {
      throw new Error("Invalid discount configuration");
    }
    return coupon;
  } catch { throw new PricingConfigurationError(); }
}

export function couponApplies(coupon, productId) {
  return !coupon.applies_to?.products?.length || coupon.applies_to.products.includes(productId);
}

export async function resolveDiscount({ user, type, periods = [], productId, subscription = false, stripe = getStripe() }) {
  const studio = type === "equipment" && await hasStudioCoverage(user.user_id, periods);
  const id = studio ? STUDIO_COUPON : isStudent(user) ? STUDENT_COUPON : null;
  if (!id) return null;
  const coupon = await loadDiscountCoupon(id, stripe);
  if (subscription && coupon.duration !== "forever") {
    throw new PricingConfigurationError();
  }
  if (!couponApplies(coupon, productId)) throw new PricingConfigurationError();
  return { couponId: id, percentOff: coupon.percent_off, label: studio ? "Studio rental: free equipment" : `Student: ${coupon.percent_off}% off` };
}

export function priceQuote(unitAmount, quantity, currency, discount) {
  const subtotal = unitAmount * quantity;
  const discountAmount = discount ? Math.round(subtotal * discount.percentOff / 100) : 0;
  return { subtotal, discountAmount, total: subtotal - discountAmount, currency, label: discount?.label || null };
}

export function discountedProduct(product, coupon) {
  if (!coupon || !couponApplies(coupon, product.id) || product.default_price?.unit_amount == null) return product;
  const quote = priceQuote(product.default_price.unit_amount, 1, product.currency, { percentOff: coupon.percent_off });
  return { ...product, originalPriceAmountFormatted: quote.subtotal / 100,
    priceAmount: quote.total, priceAmountFormatted: quote.total / 100, discountLabel: `Student: ${coupon.percent_off}% off` };
}
