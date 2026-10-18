-- Existing installations may already have the four Stripe mapping/session columns.
BEGIN;
ALTER TABLE machine ADD COLUMN IF NOT EXISTS stripe_machine_id TEXT;
ALTER TABLE room ADD COLUMN IF NOT EXISTS stripe_room_id TEXT;
ALTER TABLE machine_booking ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;
ALTER TABLE room_reservation ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

-- Equipment/room purchases are independent of membership purchases.
ALTER TABLE payment ALTER COLUMN membership_id DROP NOT NULL;

-- Multiple one-hour bookings can belong to the same Checkout Session.
CREATE INDEX IF NOT EXISTS machine_booking_checkout_session_idx ON machine_booking (stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS room_reservation_checkout_session_idx ON room_reservation (stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS payment_stripe_invoice_idx ON payment (stripe_invoice_id);
COMMIT;
