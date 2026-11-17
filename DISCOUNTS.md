# Automatic discounts

Recreate the following coupons in each Stripe account/mode using these custom IDs:

| Coupon ID | Percentage | Duration | Eligible products |
| --- | --- | --- | --- |
| `student_discount` | 30% | Forever | All products (no product restriction) |
| `studio_equipment_discount` | 100% | Forever | All hourly equipment products |

The student percentage is read from Stripe, not fixed in code. The normal rate is 30%, but changing it (for example, to 99% for testing) updates catalog prices, reservation quotes, and discount labels automatically. Studio equipment must remain 100% off to provide free reservations.

No promotion codes or customer-entered codes are required. Coupon IDs are stable configuration, even when product IDs change between accounts. Update the studio coupon's eligible products when adding or recreating equipment products. Coupons must remain valid; avoid expiration dates or redemption limits for these ongoing benefits.

One-time purchases also accept coupons with duration `once`: Stripe applies the coupon separately on every new checkout. Student subscription checkout requires `forever` so renewals keep the promised discount; a `once` student coupon produces a configuration error for subscription checkout only. Stripe coupon duration cannot be changed in place, so recreate the coupon with the same custom ID and correct duration before enabling new student subscriptions.

The stored `STUDENT` account role grants the student discount on new purchases, including new membership subscriptions. Existing subscriptions and prior purchases are not modified. Classes currently enroll without a payment flow; neither class billing nor the separate studio class coupon is implemented here.

Confirmed, uncanceled monthly studio reservations (including staff bookings) grant free equipment only when every selected period is covered. Adjacent rental periods can provide continuous coverage. Eligibility uses Eastern business time and the reserved dates, rather than the date of checkout. If any selected time is uncovered, the whole selection uses its ordinary price, with the configured student percentage if the account is a student. Discounts never stack.

Reservation quotes are private, server-calculated, pre-tax estimates. Checkout independently checks eligibility and applies the Stripe coupon to the original Stripe price. Free equipment still completes Stripe Checkout; its completed session creates a zero-dollar booking and payment ledger entry without a PaymentIntent.

Existing free equipment bookings remain free if a studio rental is canceled or moved. Rescheduling a free booking requires current studio coverage for the new dates; otherwise cancel and rebook through checkout. Cancellation of a zero-paid booking produces no refund.

## Verification

Run `npm test -- --run`, then exercise both coupons in Stripe test mode. Verify an ordinary student purchase, a student subscription, fully covered equipment, a mixed-date student selection, and free checkout completion/return/webhook delivery. Check that free completion creates only one booking and zero-dollar ledger entry even when the webhook is delivered again. No existing subscription should change.
