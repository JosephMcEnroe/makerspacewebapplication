import { businessTime } from "./businessTime";
import { getCalendarMonthCount, getCalendarMonthSelection, isMonthlyPeriod, ROOM_BOOKING_ADVANCE_DAYS } from "./monthlyReservation";
import { countEquipmentReservationHours, hasReservationBuffer, isValidEquipmentReservation, isValidReservationPeriod, mergeAdjacentReservationPeriods } from "./reservationPeriods";
import { getPool } from "./db";
import { allocateCents, dollars } from "./equipmentRefundPolicy";

export function validateCheckoutPeriods(type, periods, now = Date.now()) {
  if (!["rooms", "equipment"].includes(type) || !Array.isArray(periods) || !periods.length || periods.length > 21) throw new Error("Choose valid reservation times.");
  if (type === "rooms") {
    if (!getCalendarMonthSelection(periods) && (periods.length !== 1 || !isMonthlyPeriod(periods[0]))) throw new Error("Choose a valid one-to-twelve-month room rental.");
  } else if (periods.some(p => !(type === "equipment" ? isValidEquipmentReservation(type, p) : isValidReservationPeriod(type, p)))
    || (type === "equipment" ? !hasReservationBuffer(mergeAdjacentReservationPeriods(periods), 15) : !hasReservationBuffer(periods, 15))) {
    throw new Error(type === "rooms" ? "Choose a valid monthly room reservation." : "Choose valid machine reservation slots.");
  }
  const advance = type === "rooms" ? ROOM_BOOKING_ADVANCE_DAYS : 31;
  if (periods.some(p => !Number.isFinite(businessTime(p.start)) || !Number.isFinite(businessTime(p.end))
    || businessTime(p.start) <= now || businessTime(p.start) > now + advance * 86400000)) throw new Error(`Choose a future start within ${advance} days.`);
  const monthSelection = type === "rooms" ? getCalendarMonthSelection(periods) : null;
  const normalized = type === "equipment" ? mergeAdjacentReservationPeriods(periods)
    : monthSelection && !(periods.length === 1 && getCalendarMonthCount(periods[0].start, periods[0].end) > 1)
      ? monthSelection.periods : periods;
  return normalized.map(({ start, end }) => ({ start, end }));
}

export function bookingColumns(type) {
  return type === "rooms"
    ? { table: '"room_reservation"', id: "reservation_id", resource: "room_id", start: "start_date", end: "end_date", status: "AND (status IS NULL OR LOWER(status) NOT LIKE 'cancel%')" }
    : { table: '"machine_booking"', id: "booking_id", resource: "machine_id", start: "start_date_time", end: "end_date_time", status: "AND booking_active = true" };
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
  if (count < 1 || count > (m.reservation_type === "rooms" ? 12 : 21)) throw new Error("Invalid reservation period count.");
  const periods = Array.from({ length: count }, (_, i) => {
    const [start, end] = (m[`period_${i}`] || "").split("|");
    return { start, end };
  });
  const monthSelection = m.reservation_type === "rooms" ? getCalendarMonthSelection(periods) : null;
  if (m.reservation_type === "rooms" && (!monthSelection || (periods.length > 1 && monthSelection.count !== count))) throw new Error("Invalid selected room months.");
  // A delayed webhook must still fulfill a valid payment after its rental start.
  const firstStart = Math.min(...periods.map(p => businessTime(p.start)));
  validateCheckoutPeriods(m.reservation_type, periods, firstStart - 1);
  const normalizedPeriods = m.reservation_type === "equipment" ? mergeAdjacentReservationPeriods(periods)
    : monthSelection && !(periods.length === 1 && getCalendarMonthCount(periods[0].start, periods[0].end) > 1)
      ? monthSelection.periods : periods;
  return { type: m.reservation_type, resourceId: Number(m.resource_id), userId: Number(m.user_id), periods: normalizedPeriods };
}

export async function fulfillReservation(session) {
  if (!["paid", "no_payment_required"].includes(session.payment_status)) return;
  const { type, resourceId, userId, periods } = decodeReservation(session);
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (type === "equipment" && (session.currency !== "usd" || (!paymentIntentId && session.amount_total !== 0) || !Number.isSafeInteger(session.amount_total) || session.amount_total < 0)) {
    throw new Error("Equipment fulfillment requires a verified USD payment");
  }
  const allocations = type === "equipment" ? allocateCents(session.amount_total,
    periods.map(period => countEquipmentReservationHours([period]))) : [];
  const c = bookingColumns(type);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`reservation:${session.id}`]);
    // The ledger survives cancellations that delete machine bookings.
    const recorded = await client.query('SELECT 1 FROM "payment" WHERE stripe_invoice_id = $1', [session.id]);
    if (!recorded.rowCount) {
      const existing = await client.query(`SELECT 1 FROM ${c.table} WHERE stripe_checkout_session_id = $1`, [session.id]);
      if (!existing.rowCount) {
        // Holds and checkout-time availability races are intentionally deferred.
        for (const [index, p] of periods.entries()) {
          await client.query(`INSERT INTO ${c.table} (user_id, ${c.resource}, ${c.start}, ${c.end}, stripe_checkout_session_id${type === "rooms" ? ", status" : ", paid_amount, refund_eligible, booking_active"})
            VALUES ($1, $2, $3, $4, $5${type === "rooms" ? ", 'upcoming'" : ", $6, true, true"})`,
          [userId, resourceId, p.start, p.end, session.id, ...(type === "equipment" ? [dollars(allocations[index])] : [])]);
        }
      }
      await client.query(`INSERT INTO "payment" (user_id, membership_id, amount, payment_date, payment_method, stripe_invoice_id, stripe_checkout_session_id, stripe_payment_intent_id)
        VALUES ($1, NULL, $2, NOW(), 'stripe', $3::text, $3::text, $4)`, [userId, dollars(session.amount_total || 0), session.id, paymentIntentId || null]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
