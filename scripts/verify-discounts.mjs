// Uses test-mode credentials only; creates and immediately expires test checkouts.
// Run: node --env-file=.env.local scripts/verify-discounts.mjs
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY || "";
if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
  console.log("Skipped: configure a Stripe test-mode secret key.");
  process.exit(1);
}
const stripe = new Stripe(key, { maxNetworkRetries: 0, timeout: 15000 });
for (const [id, mode] of [["student_discount", "payment"], ["student_discount", "subscription"], ["studio_equipment_discount", "payment"]]) {
  try {
    const coupon = await stripe.coupons.retrieve(id);
    const expected = coupon.percent_off;
    if (!coupon.valid || !Number.isFinite(expected) || expected <= 0 || expected > 100
      || (id === "studio_equipment_discount" && expected !== 100)
      || (id === "student_discount" && ((mode === "subscription" && coupon.duration !== "forever") || coupon.applies_to?.products?.length))) {
      throw new Error("Coupon has incorrect validity, percentage, duration or product restrictions.");
    }
    console.log(JSON.stringify({ coupon: id, valid: coupon.valid, percentOff: coupon.percent_off, duration: coupon.duration, mode }));
    let price;
    for await (const candidate of stripe.prices.list({ active: true, type: mode === "payment" ? "one_time" : "recurring", limit: 100 })) {
      const product = typeof candidate.product === "string" ? candidate.product : candidate.product.id;
      if (candidate.currency === "usd" && candidate.unit_amount > 0 && candidate.billing_scheme === "per_unit"
        && !candidate.transform_quantity && (!coupon.applies_to?.products?.length || coupon.applies_to.products.includes(product))) {
        price = candidate;
        break;
      }
    }
    if (!price) throw new Error("No eligible USD price found for verification.");
    const session = await stripe.checkout.sessions.create({
      mode, ...(mode === "payment" && { customer_creation: "always", invoice_creation: { enabled: true } }),
      payment_method_types: ["card"], line_items: [{ price: price.id, quantity: 1 }], discounts: [{ coupon: id }],
      metadata: { test_purpose: "discount_smoke_test" }, success_url: "http://localhost:3000", cancel_url: "http://localhost:3000",
    });
    try {
      console.log(JSON.stringify({ coupon: id, mode, subtotal: session.amount_subtotal, total: session.amount_total, paymentStatus: session.payment_status }));
      const expectedTotal = session.amount_subtotal - Math.round(session.amount_subtotal * expected / 100);
      if (session.amount_total !== expectedTotal) throw new Error("Unexpected discounted checkout total.");
    } finally { await stripe.checkout.sessions.expire(session.id); }
  } catch (error) {
    console.error(JSON.stringify({ coupon: id, mode, error: error.code || error.type || "verification_failed", message: error.message }));
    process.exitCode = 1;
  }
}
