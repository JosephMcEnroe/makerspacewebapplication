import { businessTime } from "@/lib/businessTime";
import { hasReservationBuffer, isValidReservationPeriod } from "@/lib/reservationPeriods";
import { getPool, query } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { MEMBERSHIP_REQUIRED_MESSAGE, canReserve } from "@/lib/reservationAccess";
import { verifyCsrfToken } from "@/lib/csrf";
import { getStripe, loadStripeProducts, matchResourceProduct } from "@/lib/stripeCatalog";
import { bookingColumns, reservationMetadata, validateCheckoutPeriods } from "@/lib/reservationCheckout";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed" }); }
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Sign in to make a reservation." });
  if (!canReserve(user)) return res.status(403).json({ error: MEMBERSHIP_REQUIRED_MESSAGE });
  if (!verifyCsrfToken(req)) return res.status(403).json({ error: "Invalid or missing CSRF token." });
  const { type, resourceId } = req.body || {};
  let periods;
  try {
    if (!/^\d+$/.test(String(resourceId))) throw new Error("Invalid resource.");
    if (type === "rooms") {
      periods = req.body?.periods;
      if (!Array.isArray(periods) || !periods.length || periods.length > 21 || periods.some(p => !isValidReservationPeriod("rooms", p)) || !hasReservationBuffer(periods)) {
        throw new Error("Choose valid one-hour room slots with a 15-minute buffer.");
      }
      const now = Date.now();
      if (periods.some(p => !Number.isFinite(businessTime(p.start)) || !Number.isFinite(businessTime(p.end)) || businessTime(p.start) <= now || businessTime(p.start) > now + 90 * 86400000)) {
        throw new Error("Choose a future room reservation within 90 days.");
      }
    } else {
      periods = validateCheckoutPeriods(type, req.body?.periods);
    }
  } catch (error) { return res.status(400).json({ error: error.message }); }
  try {
    const room = type === "rooms";
    if (room) {
      const client = await getPool().connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1), $2)", [type, Number(resourceId)]);
        const resource = await client.query('SELECT room_id FROM "room" WHERE room_id = $1', [Number(resourceId)]);
        if (!resource.rowCount) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "Room not found." });
        }
        const reservationIds = [];
        for (const period of periods) {
        const conflict = await client.query(`SELECT 1 FROM "room_reservation" WHERE room_id = $1
          AND start_date < $3::timestamp + INTERVAL '15 minutes' AND end_date > $2::timestamp - INTERVAL '15 minutes'
          AND (status IS NULL OR LOWER(status) NOT LIKE 'cancel%') LIMIT 1`, [Number(resourceId), period.start, period.end]);
        if (conflict.rowCount) {
          await client.query("ROLLBACK");
          return res.status(409).json({ error: "One or more selected times are no longer available." });
        }
        const inserted = await client.query(`INSERT INTO "room_reservation" (user_id, room_id, start_date, end_date, status, stripe_checkout_session_id)
          VALUES ($1, $2, $3, $4, 'upcoming', NULL) RETURNING reservation_id`, [user.user_id, Number(resourceId), period.start, period.end]);
        reservationIds.push(inserted.rows[0].reservation_id);
        }
        await client.query("COMMIT");
        return res.status(201).json({ ok: true, reservationIds });
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    }
    const resource = await query('SELECT stripe_machine_id AS stripe_key, status FROM "machine" WHERE machine_id = $1', [Number(resourceId)]);
    const row = resource.rows[0];
    if (!row) return res.status(404).json({ error: "Resource not found." });
    if (row.status && row.status.toLowerCase() !== "available") return res.status(409).json({ error: "Equipment is currently unavailable." });
    const c = bookingColumns(type);
    for (const p of periods) {
      const buffer = "15 minutes";
      const conflict = await query(`SELECT 1 FROM ${c.table} WHERE ${c.resource} = $1
        AND ${c.start} < $3::timestamp + INTERVAL '${buffer}' AND ${c.end} > $2::timestamp - INTERVAL '${buffer}' ${c.status} LIMIT 1`, [Number(resourceId), p.start, p.end]);
      if (conflict.rowCount) return res.status(409).json({ error: "The selected times are no longer available." });
    }
    let product;
    try { product = matchResourceProduct(await loadStripeProducts(), type, row.stripe_key); }
    catch (error) { console.error("Reservation product configuration:", error); return res.status(503).json({ error: "This resource's Stripe pricing is not configured. Please contact staff." }); }
    const { rows } = await query('SELECT email FROM "users" WHERE user_id = $1', [user.user_id]);
    const origin = process.env.APP_URL || new URL(req.headers.origin || `http://${req.headers.host}`).origin;
    const session = await getStripe().checkout.sessions.create({
      mode: "payment", customer_email: rows[0]?.email, payment_method_types: ["card"],
      client_reference_id: String(user.user_id),
      line_items: [{ price: product.priceId, quantity: periods.length }],
      metadata: reservationMetadata(type, resourceId, user.user_id, periods),
      invoice_creation: { enabled: true },
      success_url: `${origin}/reservations/checkout-return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/equipment?canceled=true&resourceId=${resourceId}`,
    });
    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("Reservation checkout error:", error);
    return res.status(500).json({ error: type === "rooms" ? "Could not save the room reservation. Please try again." : "Could not start reservation checkout. Please try again." });
  }
}
