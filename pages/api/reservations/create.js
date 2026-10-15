import { getPool } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { verifyCsrfToken } from "@/lib/csrf";
import { hasReservationBuffer, isValidReservationPeriod } from "@/lib/reservationPeriods";

function validDateTime(value) {
  if (typeof value !== "string" || value.length !== 19 || value[4] !== "-" || value[7] !== "-" || value[10] !== "T" || value.slice(16) !== ":00") return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const hour = Number(value.slice(11, 13));
  const minute = Number(value.slice(14, 16));
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || minute % 15 !== 0) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Sign in to make a reservation." });
  if (!verifyCsrfToken(req)) return res.status(403).json({ error: "Invalid or missing CSRF token." });

  const { type, resourceId, periods } = req.body || {};
  if (!(["rooms", "equipment"].includes(type)) || !/^\d+$/.test(String(resourceId)) || !Array.isArray(periods) || periods.length < 1 || periods.length > 21) {
    return res.status(400).json({ error: "Invalid reservation details." });
  }
  if (periods.some((period) => !validDateTime(period?.start) || !validDateTime(period?.end) || !isValidReservationPeriod(type, period))) {
    return res.status(400).json({ error: "Choose a valid one-hour reservation slot." });
  }
  if (!hasReservationBuffer(periods)) {
    return res.status(400).json({ error: "Reservations must have at least a 15-minute buffer between periods." });
  }
  const now = Date.now();
  const maxAdvance = type === "rooms" ? 90 : 31;
  if (periods.some(({ start, end }) => {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    return startTime <= now || startTime > now + maxAdvance * 24 * 60 * 60 * 1000 || endTime - startTime > 24 * 60 * 60 * 1000;
  })) {
    return res.status(400).json({ error: `Reservations can be made up to ${maxAdvance} days ahead and may last up to 24 hours.` });
  }

  let client;
  let transactionStarted = false;
  try {
    client = await getPool().connect();
    await client.query("BEGIN");
    transactionStarted = true;
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1), $2)", [type, Number(resourceId)]);
    const table = type === "rooms" ? '"room_reservation"' : '"machine_booking"';
    const resourceColumn = type === "rooms" ? "room_id" : "machine_id";
    const startColumn = type === "rooms" ? "start_date" : "start_date_time";
    const endColumn = type === "rooms" ? "end_date" : "end_date_time";
    const statusClause = type === "rooms" ? "AND (status IS NULL OR LOWER(status) NOT LIKE 'cancel%')" : "";

    const reservationIds = [];
    for (const period of periods) {
      const conflict = await client.query(
        `SELECT 1 FROM ${table}
         WHERE ${resourceColumn} = $1
           AND ${startColumn} < $3::timestamp + INTERVAL '15 minutes'
           AND ${endColumn} > $2::timestamp - INTERVAL '15 minutes'
           ${statusClause}
         LIMIT 1`,
        [Number(resourceId), period.start, period.end]
      );
      if (conflict.rowCount > 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;
        return res.status(409).json({ error: "One or more selected times are no longer available. Refresh the page and choose another time." });
      }
      if (type === "rooms") {
        const inserted = await client.query(
          `INSERT INTO "room_reservation" (user_id, room_id, start_date, end_date, status)
           VALUES ($1, $2, $3, $4, 'upcoming')
           RETURNING reservation_id`,
          [user.user_id, Number(resourceId), period.start, period.end]
        );
        reservationIds.push(inserted.rows[0].reservation_id);
      } else {
        const inserted = await client.query(
          `INSERT INTO "machine_booking" (machine_id, start_date_time, end_date_time, user_id)
           VALUES ($1, $2, $3, $4)
           RETURNING booking_id`,
          [Number(resourceId), period.start, period.end, user.user_id]
        );
        reservationIds.push(inserted.rows[0].booking_id);
      }
    }
    await client.query("COMMIT");
    transactionStarted = false;
    return res.status(201).json({ ok: true, reservationIds });
  } catch (error) {
    if (transactionStarted) await client.query("ROLLBACK").catch(() => {});
    console.error("Create reservation error:", error);
    return res.status(500).json({ error: "Could not save the reservation. Please try again." });
  } finally {
    client?.release();
  }
}
