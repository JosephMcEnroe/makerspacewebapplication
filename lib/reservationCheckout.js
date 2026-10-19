import { businessTime } from "./businessTime";
import { monthlyPeriod } from "./monthlyReservation";
import { hasReservationBuffer, isValidReservationPeriod } from "./reservationPeriods";
import { getPool } from "./db";
import { getStripe } from "./stripeCatalog";

export function validateCheckoutPeriods(type, periods, now = Date.now()) {
  if (!["rooms", "equipment"].includes(type) || !Array.isArray(periods) || !periods.length || periods.length > 21) throw new Error("Choose valid reservation times.");
  if (type === "rooms") {
    const expected = monthlyPeriod(periods[0]?.start?.slice(0, 10));
    if (periods.length !== 1 || periods[0].start !== expected.start || periods[0].end !== expected.end) throw new Error("Choose one monthly room rental.");
  } else if (periods.some(p => !isValidReservationPeriod(type, p)) || !hasReservationBuffer(periods)) {
    throw new Error("Choose one-hour slots with a 15-minute buffer.");
  }
  const advance = type === "rooms" ? 90 : 31;
  if (periods.some(p => !Number.isFinite(businessTime(p.start)) || !Number.isFinite(businessTime(p.end))
    || businessTime(p.start) <= now || businessTime(p.start) > now + advance * 86400000)) throw new Error(`Choose a future start within ${advance} days.`);
  return periods.map(({ start, end }) => ({ start, end }));
}

export function bookingColumns(type) {
  return type === "rooms"
    ? { table: '"room_reservation"', id: "reservation_id", resource: "room_id", start: "start_date", end: "end_date", status: "AND (status IS NULL OR LOWER(status) NOT LIKE 'cancel%')", resourceTable: '"room"' }
    : { table: '"machine_booking"', id: "booking_id", resource: "machine_id", start: "start_date_time", end: "end_date_time", status: "", resourceTable: '"machine"' };
}

// Ledger marker for a paid checkout that was refunded instead of booked.
export const REFUNDED_PAYMENT_METHOD = "stripe_refunded";

// The idempotency key makes webhook retries return the original refund instead of refunding twice.
async function refundCheckout(session) {
  const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!paymentIntent) return;
  await getStripe().refunds.create({ payment_intent: paymentIntent }, { idempotencyKey: `reservation-refund-${session.id}` });
}

export function reservationMetadata(type, resourceId, userId, periods) {
  return { purchase_type: "reservation", reservation_type: type, resource_id: String(resourceId), user_id: String(userId),
    period_count: String(periods.length), ...Object.fromEntries(periods.map((p, i) => [`period_${i}`, `${p.start}|${p.end}`])) };
}

export function decodeReservation(session) {
  const m = session.metadata;
  if (!m || m.purchase_type !== "reservation" || !["rooms", "equipment"].includes(m.reservation_type)
    || !/^\d+$/.test(m.resource_id) || !/^\d+$/.test(m.user_id) || !/^\d+$/.test(m.period_count)) throw new Error("Invalid reservation metadata.");
  const count = Number(m.period_count);
  if (count < 1 || count > 21) throw new Error("Invalid reservation period count.");
  const periods = Array.from({ length: count }, (_, i) => {
    const [start, end] = (m[`period_${i}`] || "").split("|");
    return { start, end };
  });
  // A delayed webhook must still fulfill a valid payment after its rental start.
  const firstStart = Math.min(...periods.map(p => businessTime(p.start)));
  validateCheckoutPeriods(m.reservation_type, periods, firstStart - 1);
  return { type: m.reservation_type, resourceId: Number(m.resource_id), userId: Number(m.user_id), periods };
}

export async function fulfillReservation(session) {
  if (!["paid", "no_payment_required"].includes(session.payment_status)) return;
  let reservation;
  try {
    reservation = decodeReservation(session);
  } catch (error) {
    // Retrying can't fix bad metadata, so refund now and acknowledge the event instead of failing it.
    console.error(`[Webhook] Refunding reservation checkout ${session.id} with invalid metadata:`, error.message);
    await refundCheckout(session);
    return;
  }
  const { type, resourceId, userId, periods } = reservation;
  const c = bookingColumns(type);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`reservation:${session.id}`]);
    // The ledger survives cancellations that delete machine bookings.
    const recorded = await client.query('SELECT 1 FROM "payment" WHERE stripe_invoice_id = $1', [session.id]);
    if (!recorded.rowCount) {
      let paidAmount = (session.amount_total || 0) / 100;
      let paymentMethod = "stripe";
      const existing = await client.query(`SELECT 1 FROM ${c.table} WHERE stripe_checkout_session_id = $1`, [session.id]);
      if (!existing.rowCount) {
        // Same lock as create/update, so nobody can book these times between the check and the insert.
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1), $2)", [type, resourceId]);
        const resource = await client.query(`SELECT 1 FROM ${c.resourceTable} WHERE ${c.resource} = $1`, [resourceId]);
        let available = resource.rowCount > 0;
        // Availability was only checked when checkout started; someone else may have paid for these times since.
        const buffer = type === "rooms" ? "0 minutes" : "15 minutes";
        for (const p of periods) {
          if (!available) break;
          const conflict = await client.query(`SELECT 1 FROM ${c.table} WHERE ${c.resource} = $1
            AND ${c.start} < $3::timestamp + INTERVAL '${buffer}' AND ${c.end} > $2::timestamp - INTERVAL '${buffer}' ${c.status} LIMIT 1`,
            [resourceId, p.start, p.end]);
          available = !conflict.rowCount;
        }
        if (available) {
          for (const p of periods) {
            await client.query(`INSERT INTO ${c.table} (user_id, ${c.resource}, ${c.start}, ${c.end}, stripe_checkout_session_id${type === "rooms" ? ", status" : ""})
              VALUES ($1, $2, $3, $4, $5${type === "rooms" ? ", 'upcoming'" : ""})`, [userId, resourceId, p.start, p.end, session.id]);
          }
        } else {
          // Refund before committing: if the refund fails, the rollback lets Stripe retry the whole event.
          console.warn(`[Webhook] Reservation checkout ${session.id} lost its times; refunding instead of double-booking.`);
          await refundCheckout(session);
          paidAmount = 0;
          paymentMethod = REFUNDED_PAYMENT_METHOD;
        }
      }
      await client.query(`INSERT INTO "payment" (user_id, membership_id, amount, payment_date, payment_method, stripe_invoice_id)
        VALUES ($1, NULL, $2, NOW(), $3, $4)`, [userId, paidAmount, paymentMethod, session.id]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
