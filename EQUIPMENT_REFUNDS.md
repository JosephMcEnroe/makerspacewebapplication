# Equipment cancellations and refunds

Equipment cancellation retains the booking with `booking_active = false`, releases capacity, and records any approved refund before contacting Stripe. Eligibility is evaluated per unstarted purchased hour at acceptance, using 24 elapsed hours; exactly 24 hours qualifies. The last 15 minutes of a booking are cleanup, not an additional purchased hour. Discounts and tax are included in the actual paid amount. USD is the only supported currency.

Successful equipment edits permanently set `refund_eligible = false`. Existing paid-duration restrictions continue to apply. Staff-created equipment bookings still bypass Checkout in this phase and explicitly remain non-refundable. Members, staff, and administrators follow the same cancellation policy, without overrides. Other cards from the same purchase remain active.

## Database prerequisites

Database changes are managed separately by the owner. The application does not apply migrations or backfill records automatically.

- `machine_booking`: `booking_active boolean`, `cancelled_at timestamptz`, `cancelled_by` referencing users, `paid_amount numeric(10,2)`, `refund_eligible boolean` (default false).
- `payment`: `stripe_checkout_session_id text`, `stripe_payment_intent_id text`, alongside existing amount and legacy invoice reference.
- `equipment_refund`: identity primary key `refund_id`, unique booking foreign key `booking_id`, payment foreign key `payment_id`, nonnegative `amount numeric(10,2)`, `status`, unique nullable `stripe_refund_id`.
- Allowed refund statuses: `queued`, `pending`, `succeeded`, `failed`, `not_required`.

New paid fulfillment populates the payment references and booking allocations. Historical bookings with missing verified amounts/payment references cannot produce automatic refunds, even if their eligibility flag is true. Unpaid cancellations have no refund row because the payment foreign key is required. Existing payment ledger rows must be retained to suppress replayed historical Checkout fulfillment.

## Configuration

Keep `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in the same Stripe test/live environment. The webhook secret also signs short-lived cancellation previews. Enable `refund.created`, `refund.updated`, and `refund.failed` on the existing `/api/stripe-webhook` endpoint, preserving existing subscriptions.

Set a random server-only `CRON_SECRET` in Vercel. The protected `GET /api/cron/equipment-refunds` route requires `Authorization: Bearer <CRON_SECRET>`. `vercel.json` configures a daily 08:00 UTC recovery run compatible with Hobby scheduling. On a suitable paid plan, the schedule can be made more frequent. Normal cancellation attempts submission immediately; no background work is left running after its response.

Recovery checks up to ten queued/pending records per invocation within a time budget. Randomized selection within each priority prevents permanently pending records from monopolizing the batch. Monitor backlog and increase frequency if needed. Vercel scheduling requires a deployed production configuration; it does not run automatically under `npm run dev`.

## Recovery and manual refunds

Cancellation and the approved amount are committed together. A stable refund-operation key and Stripe metadata permit reconciliation after timeouts, including after the provider's idempotency retention period. Refunds sharing a payment are serialized in PostgreSQL. Webhooks retrieve current provider state rather than trusting delivery order.

Queued records remain recoverable after network errors. Provider failures, canceled refunds, and action-required refunds appear as "Refund needs attention"; no replacement refund is automatically issued. Inspect those cases in Stripe and application logs. Dashboard refunds without a known per-booking allocation stop new automatic refunds on that payment for manual review, rather than guessing which reservation's funds remain available. Do not use Dashboard refunds as an alternative cancellation workflow.

Original payment amounts are not changed. Financial reports continue using Stripe balance activity, which includes refunds separately.

## Frontend acceptance checks

Use Stripe test mode and fresh purchases after deployment. Do not change historical booking times directly to simulate these checks: that bypasses the application's edit policy. Test card 4242 4242 4242 4242 may be used with a future expiry and test CVC. Apple Pay can also be tested on a compatible configured device.

| Scenario | Frontend steps | Expected result |
| --- | --- | --- |
| Full refund | Purchase equipment more than 24 hours away; open Reservations > Equipment > Cancel. | Preview shows all remaining paid hours as refundable. Confirm moves the card to Cancelled, followed by refunded status. |
| Keep reservation | Open a preview and choose Keep reservation or press Escape. | Booking and payment remain unchanged. |
| Late cancellation | Purchase an available hour less than 24 hours away and cancel. | Explicit $0 preview and "Cancel with no refund" action. No provider refund is submitted. |
| Mixed eligibility | Purchase a continuous block tomorrow spanning the current time of day. | Hours inside 24 hours receive $0; later hours refund their allocated amounts. |
| Shared purchase | In one Checkout, purchase separated blocks; cancel only one resulting card. | Only that card is cancelled/refunded; the other remains active. |
| Rebooking | After cancellation, open the same machine/time using another member account. | Released slots are available; the original cancelled card remains in history. |
| Edited reservation | Purchase more than 24 hours ahead, save an equal-duration edit, then cancel. | Edit warning is visible before saving; subsequent cancellation is $0. |
| Abandoned/failed edit | Open Edit, then leave without saving, or submit an unavailable time. | Refund eligibility is preserved. |
| Staff cancellation | Open Members > member > Reservations; cancel a fresh paid booking. | Same preview and policy; staff actor is saved as `cancelled_by`. |
| Staff direct booking | Create an equipment booking from the staff screen and cancel it. | Non-refundable; no Checkout or automatic monetary refund is created. |
| Legacy booking | Cancel a retained historical booking with no verified allocation. | Clear non-refundable preview; capacity is released. |
| Two tabs | Open cancellation for the same booking in two tabs and confirm both. | One cancellation and at most one refund. Refresh shows the same result. |
| Manual Dashboard refund | Use a separate test purchase, refund it in Stripe first, then cancel in the app. | No second automatic refund; booking is cancelled and shows refund needs attention. |
| Status refresh | Refresh reservation/refund status from member and staff screens. | Server state is displayed; cancelled equipment has no Edit/Cancel actions. |
| Regression | Create/cancel a room and class; make a membership purchase. | Existing unrelated behavior continues to work. |

Provider-dependent checks require Stripe/Vercel in addition to the frontend:

- Verify the Stripe refund amount and original payment after each monetary test.
- Replay refund webhook deliveries; no duplicate refund should appear.
- In test mode, simulate an interrupted submission and run recovery; cancellation remains saved and reconciliation must not create a second refund.
- Verify a configured pending/failed refund shows the corresponding state after webhook delivery and refresh.
- Test the protected cron endpoint with missing/wrong authorization (401) and correct authorization, then inspect Vercel's scheduled execution logs. Never put its secret in browser code or URLs.
- Verify cancelled equipment denies RFID access.
- Compare a financial report for the test period with Stripe balance activity; processing fees remain separate from the refund.

The exact 24-hour boundary, expiration/reconfirmation behavior, penny allocation, and daylight-saving boundaries are covered by automated tests because precisely reproducing them with normal frontend timing is unreliable.

## Verification commands

Run `npm test -- --run`, `npm run lint`, and `npm run build`. Automated tests use mocked payment/database calls; they do not establish live Stripe execution, webhook delivery, or the deployed database schema.
