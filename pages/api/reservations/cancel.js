import { getPool } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { verifyCsrfToken } from "@/lib/csrf";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Sign in to cancel a reservation." });
  if (!verifyCsrfToken(req)) return res.status(403).json({ error: "Invalid or missing CSRF token." });

  const { type, reservationId } = req.body || {};
  if (!Number.isInteger(Number(reservationId)) || Number(reservationId) < 1 || !["room", "equipment", "class"].includes(type)) {
    return res.status(400).json({ error: "Invalid reservation." });
  }

  try {
    // Only upcoming reservations can be cancelled; the UI hides the button, but the API must enforce it too
    const startQuery = {
      class: `SELECT c.class_date + COALESCE(c.class_time::time, '00:00'::time) AS starts_at
              FROM "class_enrollment" e JOIN "class" c ON c.class_id = e.class_id
              WHERE e.class_id = $1 AND e.user_id = $2`,
      room: `SELECT start_date AS starts_at FROM "room_reservation"
             WHERE reservation_id = $1 AND user_id = $2 AND (status IS NULL OR LOWER(status) NOT LIKE 'cancel%')`,
      equipment: `SELECT start_date_time AS starts_at FROM "machine_booking" WHERE booking_id = $1 AND user_id = $2`,
    }[type];
    const current = await getPool().query(startQuery, [Number(reservationId), user.user_id]);
    if (!current.rowCount) return res.status(404).json({ error: "Reservation not found." });
    if (new Date(current.rows[0].starts_at) <= new Date()) {
      return res.status(400).json({ error: "Reservations that have already started can't be cancelled." });
    }

    let result;
    if (type === "class") {
      result = await getPool().query(
        `DELETE FROM "class_enrollment" WHERE class_id = $1 AND user_id = $2 RETURNING class_id`,
        [Number(reservationId), user.user_id]
      );
    } else if (type === "room") {
      result = await getPool().query(
        `UPDATE "room_reservation" SET status = 'cancelled'
         WHERE reservation_id = $1 AND user_id = $2
           AND (status IS NULL OR LOWER(status) NOT LIKE 'cancel%')
         RETURNING reservation_id`,
        [Number(reservationId), user.user_id]
      );
    } else {
      result = await getPool().query(
        `DELETE FROM "machine_booking" WHERE booking_id = $1 AND user_id = $2 RETURNING booking_id`,
        [Number(reservationId), user.user_id]
      );
    }
    if (!result.rowCount) return res.status(404).json({ error: "Reservation not found." });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Cancel reservation error:", error);
    return res.status(500).json({ error: "Could not cancel the reservation." });
  }
}
