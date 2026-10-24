# Reservation checkout setup

Apply `migrations/20261016_reservation_checkout.sql` before enabling the feature. It creates no tables. The Stripe columns may already exist; the migration also makes `payment.membership_id` nullable for purchases unrelated to a membership and adds lookup indexes.

Match each database `machine.stripe_machine_id` to Stripe **product** metadata `equipment_id`: `3d_printer`, `metal_lathe`, `wood_lathe`, `small_cnc`, `large_cnc`, or `laser`. Room cards load directly from the database with local images and need no Stripe mapping. Existing room Stripe mapping columns are retained for compatibility. Numeric database IDs stay unchanged. Unmapped equipment does not appear in the Stripe reservation catalog. Multiple physical machines may share a rate key; availability remains per machine.

Use exactly one active product per metadata key, with an active fixed per-unit **one-time default price** in the account's currency. Equipment price is for one hour. New room reservations bypass Stripe entirely; their existing Stripe prices do not need changing. The application does not change Stripe products or prices. Stripe image URLs take precedence; local resource images are fallback images.

Keep `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` configured for the same Stripe environment. Set `APP_URL` to the site's public origin for production redirects. Configure the existing `/api/stripe-webhook` endpoint to receive `checkout.session.completed` and `checkout.session.async_payment_succeeded` in addition to existing membership events. Reservation payments are handled separately from membership activation.

Equipment checkout quantity is the number of validated one-hour slots (15-minute buffers are not billed). Consecutive machine slots are merged into one continuous booking row, while non-consecutive times remain separate reservations. Customer-facing machine reservation times end 15 minutes before the stored end to reserve cleanup time. Rooms use the original hourly calendar with one-hour slots, 15-minute buffers, and a 90-day booking window. Room bookings save immediately in a database transaction with a room-level advisory lock and overlap check, without payment or a payment ledger entry. Their `stripe_checkout_session_id` remains null. Equipment bookings are inserted only after a paid webhook arrives. The return page polls the user's session status, with manual refresh after approximately one minute.

Each paid equipment booking stores `stripe_checkout_session_id`. Previously paid room records and their webhook fulfillment remain supported. Monthly room bookings are recognized by their stored start/end dates, so direct monthly bookings keep the monthly editor and legacy hourly rooms keep their hourly editor. Reservation payment ledger entries use the Checkout Session ID in `stripe_invoice_id` as a stable reconciliation/idempotency reference. A database transaction and per-session advisory lock prevent repeat fulfillment, including after machine bookings are deleted by cancellation. Payment failures roll back both bookings and ledger entry and return HTTP 500 for Stripe retries. Equipment bookings can be rescheduled as one or more periods on the original machine; paid studio bookings remain one month on the original room. Cancellation follows the existing behavior and does not refund payments.

## Deferred limitations for the PR

- For equipment: no temporary holds, hold tables, or post-payment availability conflict resolution. Availability is checked before checkout; two customers can pay for overlapping times. Paid sessions are fulfilled even if availability changed. Holds/refund handling will be implemented later.
- No automatic refunds or price adjustments. Standalone `/stripe/checkout` remains a debugging checkout and does not create reservations.
- Repeated separate checkout attempts can create distinct paid reservations; do not confuse those with retries of a webhook for one session.

## Verification

Run `npm test -- --run`, `npm run lint`, and `npm run build`. Verify direct hourly room reservations and overlap rejection without Stripe. In Stripe test mode, verify one and three equipment slots, cancellation, pending return-page status, and replay of a completed checkout webhook. Confirm the payment ledger and booking rows are created once and membership/day-pass purchases still work. Use test mode for payment verification; the implementation does not create test charges automatically.
