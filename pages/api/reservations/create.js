import { businessTime } from "@/lib/businessTime";
import { countEquipmentReservationHours, hasReservationBuffer, isValidReservationPeriod } from "@/lib/reservationPeriods";
import { mergeRoomReservationPeriods } from "@/lib/reservationGrouping";
import { getCalendarMonthCount, isMonthlyPeriod } from "@/lib/monthlyReservation";
import { isMonthlyStudioResource } from "@/lib/resourceGroups";
import { getPool, query } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { verifyCsrfToken } from "@/lib/csrf";
import { getStripe, loadStripeProducts, matchResourceProduct } from "@/lib/stripeCatalog";
import { bookingColumns, reservationMetadata, validateCheckoutPeriods } from "@/lib/reservationCheckout";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed" }); }
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Sign in to make a reservation." });
  if (!verifyCsrfToken(req)) return res.status(403).json({ error: "Invalid or missing CSRF token." });

  const { type, resourceId } = req.body || {};
  let periods;
  let calendarMonths = null;
  try {
    if (!/^\d+$/.test(String(resourceId))) throw new Error("Invalid resource.");
    if (type === "rooms") {
      periods = req.body?.periods;
      calendarMonths = Array.isArray(periods) && periods.length === 1
        ? getCalendarMonthCount(periods[0]?.start, periods[0]?.end)
        : null;
      if (calendarMonths === null && Array.isArray(periods) && periods.length === 1 && isMonthlyPeriod(periods[0])) {
        throw new Error("Studio rentals must start on the first day of a calendar month.");
      }
      if (calendarMonths !== null) {
        const start = businessTime(periods[0].start);
        if (!Number.isFinite(start) || start <= Date.now() || start > Date.now() + 90 * 86400000) {
          throw new Error("Choose one to twelve future calendar months starting within 90 days.");
        }
      } else {
        if (!Array.isArray(periods) || !periods.length || periods.length > 21
          || periods.some(period => !isValidReservationPeriod("rooms", period)) || !hasReservationBuffer(periods)) {
          throw new Error("Choose valid one-hour room slots with a 15-minute buffer.");
        }
        periods = mergeRoomReservationPeriods(periods, { userId: user.user_id, roomId: Number(resourceId) });
        const now = Date.now();
        if (periods.some(period => !Number.isFinite(businessTime(period.start)) || !Number.isFinite(businessTime(period.end))
          || businessTime(period.start) <= now || businessTime(period.start) > now + 90 * 86400000)) {
          throw new Error("Choose a future room reservation within 90 days.");
        }
      }
    } else {
      periods = validateCheckoutPeriods(type, req.body?.periods);
    }
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  try {
    if (type === "rooms") {
      const { rows } = await query(
        'SELECT room_id, name, type, stripe_room_id AS stripe_key FROM "room" WHERE room_id = $1',
        [Number(resourceId)]
      );
      const room = rows[0];
      if (!room) return res.status(404).json({ error: "Room not found." });

      if (calendarMonths !== null) {
        if (!isMonthlyStudioResource({ name: room.name, description: room.type })) {
          return res.status(400).json({ error: "Only studios can be rented by calendar month." });
        }
        const client = await getPool().connect();
        let conflict;
        try {
          await client.query("BEGIN");
          await client.query("SELECT pg_advisory_xact_lock(hashtext($1), $2)", [type, Number(resourceId)]);
          conflict = await client.query(`SELECT 1 FROM "room_reservation" WHERE room_id = $1
            AND start_date < $3::timestamp AND end_date > $2::timestamp
            AND (status IS NULL OR LOWER(status) NOT LIKE 'cancel%') LIMIT 1`,
          [Number(resourceId), periods[0].start, periods[0].end]);
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
        if (conflict.rowCount) return res.status(409).json({ error: "This studio is unavailable during part of the selected months." });

        let product;
        try {
          product = matchResourceProduct(await loadStripeProducts(), "rooms", room.stripe_key);
        } catch (error) {
          console.error("Studio rental pricing configuration:", error);
          return res.status(503).json({ error: "This studio's monthly Stripe pricing is not configured. Please contact staff." });
        }
        const { rows: userRows } = await query('SELECT email FROM "users" WHERE user_id = $1', [user.user_id]);
        const origin = process.env.APP_URL || new URL(req.headers.origin || `http://${req.headers.host}`).origin;
        const session = await getStripe().checkout.sessions.create({
          mode: "payment",
          customer_email: userRows[0]?.email,
          payment_method_types: ["card"],
          client_reference_id: String(user.user_id),
          line_items: [{ price: product.priceId, quantity: calendarMonths }],
          metadata: reservationMetadata(type, resourceId, user.user_id, periods),
          invoice_creation: { enabled: true },
          success_url: `${origin}/reservations/checkout-return?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/rooms?canceled=true&resourceId=${resourceId}`,
        });
        return res.status(200).json({ url: session.url });
      }

      const client = await getPool().connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1), $2)", [type, Number(resourceId)]);
        const reservationIds = [];
        for (const period of periods) {
          const conflict = await client.query(`SELECT 1 FROM "room_reservation" WHERE room_id = $1
            AND start_date < $3::timestamp + INTERVAL '15 minutes' AND end_date > $2::timestamp - INTERVAL '15 minutes'
            AND (status IS NULL OR LOWER(status) NOT LIKE 'cancel%') LIMIT 1`,
          [Number(resourceId), period.start, period.end]);
          if (conflict.rowCount) {
            await client.query("ROLLBACK");
            return res.status(409).json({ error: "One or more selected times are no longer available." });
          }
          const inserted = await client.query(`INSERT INTO "room_reservation" (user_id, room_id, start_date, end_date, status, stripe_checkout_session_id)
            VALUES ($1, $2, $3, $4, 'upcoming', NULL) RETURNING reservation_id`,
          [user.user_id, Number(resourceId), period.start, period.end]);
          reservationIds.push(inserted.rows[0].reservation_id);
        }
        await client.query("COMMIT");
        return res.status(201).json({ ok: true, reservationIds });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }

    const resource = await query('SELECT stripe_machine_id AS stripe_key, status FROM "machine" WHERE machine_id = $1', [Number(resourceId)]);
    const row = resource.rows[0];
    if (!row) return res.status(404).json({ error: "Resource not found." });
    if (row.status && row.status.toLowerCase() !== "available") return res.status(409).json({ error: "Equipment is currently unavailable." });
    const columns = bookingColumns(type);
    const buffer = type === "equipment" ? "0 minutes" : "15 minutes";
    for (const period of periods) {
      const conflict = await query(`SELECT 1 FROM ${columns.table} WHERE ${columns.resource} = $1
        AND ${columns.start} < $3::timestamp + INTERVAL '${buffer}' AND ${columns.end} > $2::timestamp - INTERVAL '${buffer}' ${columns.status} LIMIT 1`,
      [Number(resourceId), period.start, period.end]);
      if (conflict.rowCount) return res.status(409).json({ error: "The selected times are no longer available." });
    }
    let product;
    try {
      product = matchResourceProduct(await loadStripeProducts(), type, row.stripe_key);
    } catch (error) {
      console.error("Reservation product configuration:", error);
      return res.status(503).json({ error: "This resource's Stripe pricing is not configured. Please contact staff." });
    }
    const { rows } = await query('SELECT email FROM "users" WHERE user_id = $1', [user.user_id]);
    const origin = process.env.APP_URL || new URL(req.headers.origin || `http://${req.headers.host}`).origin;
    const session = await getStripe().checkout.sessions.create({
      mode: "payment", customer_email: rows[0]?.email, payment_method_types: ["card"],
      client_reference_id: String(user.user_id),
      line_items: [{ price: product.priceId, quantity: type === "equipment" ? countEquipmentReservationHours(periods) : periods.length }],
      metadata: reservationMetadata(type, resourceId, user.user_id, periods),
      invoice_creation: { enabled: true },
      success_url: `${origin}/reservations/checkout-return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/equipment?canceled=true&resourceId=${resourceId}`,
    });
    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("Reservation checkout error:", error);
    return res.status(500).json({ error: "Could not start reservation checkout. Please try again." });
  }
}
