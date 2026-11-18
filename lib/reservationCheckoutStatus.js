import { getStripe } from "@/lib/stripeCatalog";
import { query } from "@/lib/db";
import { bookingColumns } from "@/lib/reservationCheckout";
import { formatTimeRange } from "@/lib/format";
import { mergeAdjacentReservationPeriods, reservationCustomerEndDateTime } from "@/lib/reservationPeriods";

export async function sendReservationCheckoutStatus(req, res, { userId, staff = false }) {
  if (typeof req.query.session_id !== "string" || !req.query.session_id.startsWith("cs_")) return res.status(400).json({ error: "Invalid checkout session." });
  try {
    const session = await getStripe().checkout.sessions.retrieve(req.query.session_id);
    const m = session.metadata;
    if (m?.purchase_type !== "reservation" || !/^\d+$/.test(m.user_id) || !["rooms", "equipment"].includes(m.reservation_type)) return res.status(404).json({ error: "Checkout not found." });
    const authorized = staff
      ? m.staff_user_id === String(userId)
      : !m.staff_user_id && m.user_id === String(userId);
    if (!authorized) return res.status(404).json({ error: "Checkout not found." });
    const c = bookingColumns(m.reservation_type);
    const result = await query(`SELECT ${c.id} AS id, ${c.start}::text AS start_time, ${c.end}::text AS end_time FROM ${c.table} WHERE stripe_checkout_session_id = $1 AND user_id = $2 ORDER BY ${c.start}`, [session.id, Number(m.user_id)]);
    const confirmed = result.rowCount > 0;
    const reservationTimes = mergeAdjacentReservationPeriods(result.rows.map(({ start_time, end_time }) => ({
      start: String(start_time).replace(" ", "T").slice(0, 19),
      end: String(end_time).replace(" ", "T").slice(0, 19),
    }))).map(({ start, end }) => ({
      start,
      end: m.reservation_type === "equipment" ? reservationCustomerEndDateTime(end, 15) : end,
      time: formatTimeRange(start, m.reservation_type === "equipment" ? reservationCustomerEndDateTime(end, 15) : end),
    }));
    return res.json({ status: confirmed ? "confirmed" : session.status === "expired" ? "expired" : session.payment_status === "unpaid" ? "unpaid" : "processing",
      ...(staff && { memberId: Number(m.user_id) }),
      type: m.reservation_type, reservationIds: result.rows.map(r => r.id),
      reservationTimes: m.reservation_type === "equipment" ? reservationTimes : [],
      checkoutUrl: session.status === "open" ? session.url : null });
  } catch (error) { console.error("Checkout status:", error); return res.status(500).json({ error: "Could not load checkout status." }); }
}
