import { monthlyPeriod, isMonthlyReservation } from "@/lib/monthlyReservation";
import { businessTime } from "@/lib/businessTime";
import { getPool } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { verifyCsrfToken } from "@/lib/csrf";
import { hasReservationBuffer, isValidReservationPeriod } from "@/lib/reservationPeriods";

function isMonthlyPeriod(periods) {
  try {
    const expected = monthlyPeriod(periods[0]?.start?.slice(0, 10));
    return periods.length === 1 && periods[0].start === expected.start && periods[0].end === expected.end;
  } catch { return false; }
}

function validDateTime(value) {
  if (typeof value !== "string" || value.length !== 19 || value[4] !== "-" || value[7] !== "-" || value[10] !== "T" || value.slice(16) !== ":00") return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const hour = Number(value.slice(11, 13));
  const minute = Number(value.slice(14, 16));
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
    && hour <= 23 && minute <= 59 && minute % 15 === 0;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Sign in to edit a reservation." });
  if (!verifyCsrfToken(req)) return res.status(403).json({ error: "Invalid or missing CSRF token." });

  const { type, reservationId, periods } = req.body || {};
  if (!["rooms", "equipment"].includes(type) || !/^\d+$/.test(String(reservationId)) || !Array.isArray(periods) || periods.length < 1 || periods.length > 21 || (!(type === "rooms" && isMonthlyPeriod(periods)) && periods.some((period) => !validDateTime(period?.start) || !validDateTime(period?.end) || !isValidReservationPeriod(type, period)))) {
    return res.status(400).json({ error: "Choose valid one-hour reservation slots." });
  }
  if (!(type === "rooms" && isMonthlyPeriod(periods)) && !hasReservationBuffer(periods)) {
    return res.status(400).json({ error: "Reservations must have at least a 15-minute buffer between periods." });
  }
  const maxAdvance = type === "rooms" ? 90 : 31;
  if (periods.some(({ start }) => !Number.isFinite(businessTime(start)) || businessTime(start) <= Date.now() || businessTime(start) > Date.now() + maxAdvance * 86400000)) {
    return res.status(400).json({ error: `Reservations can be changed up to ${maxAdvance} days in advance.` });
  }

  let client;
  let transactionStarted = false;
  try {
    client = await getPool().connect();
    await client.query("BEGIN");
    transactionStarted = true;
    const room = type === "rooms";
    const table = room ? '"room_reservation"' : '"machine_booking"';
    const idColumn = room ? "reservation_id" : "booking_id";
    const resourceColumn = room ? "room_id" : "machine_id";
    const startColumn = room ? "start_date" : "start_date_time";
    const endColumn = room ? "end_date" : "end_date_time";
    const statusClause = room ? "AND (status IS NULL OR LOWER(status) NOT LIKE 'cancel%')" : "";
    const current = await client.query(
      `SELECT ${resourceColumn} AS resource_id, stripe_checkout_session_id, ${startColumn} AS start_time, ${endColumn} AS end_time FROM ${table}
       WHERE ${idColumn} = $1 AND user_id = $2 ${statusClause} FOR UPDATE`,
      [Number(reservationId), user.user_id]
    );
    if (!current.rowCount) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(404).json({ error: "Reservation not found." });
    }
    const monthly = room && isMonthlyReservation(current.rows[0].start_time, current.rows[0].end_time);
    if ((monthly && !isMonthlyPeriod(periods)) || (current.rows[0].stripe_checkout_session_id && (room ? !isMonthlyPeriod(periods) : periods.length !== 1))) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(400).json({ error: room ? "A monthly room rental must remain one month." : "Reschedule each purchased one-hour booking separately." });
    }
    const buffer = room && isMonthlyPeriod(periods) ? "0 minutes" : "15 minutes";
    const resourceId = Number(current.rows[0].resource_id);
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1), $2)", [type, resourceId]);
    for (const period of periods) {
      const conflict = await client.query(
        `SELECT 1 FROM ${table}
         WHERE ${resourceColumn} = $1 AND ${idColumn} <> $2
           AND ${startColumn} < $4::timestamp + INTERVAL '${buffer}'
           AND ${endColumn} > $3::timestamp - INTERVAL '${buffer}' ${statusClause}
         LIMIT 1`,
        [resourceId, Number(reservationId), period.start, period.end]
      );
      if (conflict.rowCount) {
        await client.query("ROLLBACK");
        transactionStarted = false;
        return res.status(409).json({ error: "One or more selected times are no longer available." });
      }
    }

    if (periods.length === 1) {
      await client.query(
        `UPDATE ${table} SET ${startColumn} = $3, ${endColumn} = $4 WHERE ${idColumn} = $1 AND user_id = $2`,
        [Number(reservationId), user.user_id, periods[0].start, periods[0].end]
      );
    } else {
      await client.query(`DELETE FROM ${table} WHERE ${idColumn} = $1 AND user_id = $2`, [Number(reservationId), user.user_id]);
      for (const period of periods) {
        if (room) {
          await client.query(
            `INSERT INTO "room_reservation" (user_id, room_id, start_date, end_date, status) VALUES ($1, $2, $3, $4, 'upcoming')`,
            [user.user_id, resourceId, period.start, period.end]
          );
        } else {
          await client.query(
            `INSERT INTO "machine_booking" (machine_id, start_date_time, end_date_time, user_id) VALUES ($1, $2, $3, $4)`,
            [resourceId, period.start, period.end, user.user_id]
          );
        }
      }
    }
    await client.query("COMMIT");
    transactionStarted = false;
    return res.status(200).json({ ok: true });
  } catch (error) {
    if (transactionStarted) await client.query("ROLLBACK").catch(() => {});
    console.error("Update reservation error:", error);
    return res.status(500).json({ error: "Could not update the reservation." });
  } finally {
    client?.release();
  }
}
