import { businessTime } from "./businessTime";
import { monthlyPeriod } from "./monthlyReservation";
import { countEquipmentReservationHours, hasReservationBuffer, isValidEquipmentReservation, isValidReservationPeriod, mergeAdjacentReservationPeriods } from "./reservationPeriods";
import { getPool } from "./db";

export function validateCheckoutPeriods(type, periods, now = Date.now()) {
  if (!["rooms", "equipment"].includes(type) || !Array.isArray(periods) || !periods.length || periods.length > 21) throw new Error("Choose valid reservation times.");
  if (type === "rooms") {
    const expected = monthlyPeriod(periods[0]?.start?.slice(0, 10));
    if (periods.length !== 1 || periods[0].start !== expected.start || periods[0].end !== expected.end) throw new Error("Choose one monthly room rental.");
  } else if (periods.some(p => !(type === "equipment" ? isValidEquipmentReservation(type, p) : isValidReservationPeriod(type, p)))
    || (type === "equipment" ? !hasReservationBuffer(mergeAdjacentReservationPeriods(periods), 15) : !hasReservationBuffer(periods, 15))) {
    throw new Error(type === "rooms" ? "Choose a valid monthly room reservation." : "Choose valid machine reservation slots.");
  }
  const advance = type === "rooms" ? 90 : 31;
  if (periods.some(p => !Number.isFinite(businessTime(p.start)) || !Number.isFinite(businessTime(p.end))
    || businessTime(p.start) <= now || businessTime(p.start) > now + advance * 86400000)) throw new Error(`Choose a future start within ${advance} days.`);
  const normalized = type === "equipment" ? mergeAdjacentReservationPeriods(periods) : periods;
  return normalized.map(({ start, end }) => ({ start, end }));
}

export function bookingColumns(type) {
  return type === "rooms"
    ? { table: '"room_reservation"', id: "reservation_id", resource: "room_id", start: "start_date", end: "end_date", status: "AND (status IS NULL OR LOWER(status) NOT LIKE 'cancel%')" }
    : { table: '"machine_booking"', id: "booking_id", resource: "machine_id", start: "start_date_time", end: "end_date_time", status: "" };
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
  const normalizedPeriods = m.reservation_type === "equipment" ? mergeAdjacentReservationPeriods(periods) : periods;
  return { type: m.reservation_type, resourceId: Number(m.resource_id), userId: Number(m.user_id), periods: normalizedPeriods };
}

export async function fulfillReservation(session) {
  if (!["paid", "no_payment_required"].includes(session.payment_status)) return;
  const { type, resourceId, userId, periods } = decodeReservation(session);
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
        for (const p of periods) {
          await client.query(`INSERT INTO ${c.table} (user_id, ${c.resource}, ${c.start}, ${c.end}, stripe_checkout_session_id${type === "rooms" ? ", status" : ""})
            VALUES ($1, $2, $3, $4, $5${type === "rooms" ? ", 'upcoming'" : ""})`, [userId, resourceId, p.start, p.end, session.id]);
        }
      }
      await client.query(`INSERT INTO "payment" (user_id, membership_id, amount, payment_date, payment_method, stripe_invoice_id)
        VALUES ($1, NULL, $2, NOW(), 'stripe', $3)`, [userId, (session.amount_total || 0) / 100, session.id]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
