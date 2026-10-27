import { getMonthlyReservationCount, isMonthlyPeriod, isMonthlyReservation } from "@/lib/monthlyReservation";
import { businessTime } from "@/lib/businessTime";
import { getPool } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { verifyCsrfToken } from "@/lib/csrf";
import { hasReservationBuffer, isValidEquipmentReservation, isValidReservationPeriod, mergeAdjacentReservationPeriods } from "@/lib/reservationPeriods";
import { mergeRoomReservationPeriods } from "@/lib/reservationGrouping";
import { isMonthlyStudioResource } from "@/lib/resourceGroups";

function isMonthlyPeriodList(periods) {
  return periods.length === 1 && isMonthlyPeriod(periods[0]);
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

  const { type, reservationId, reservationIds, periods } = req.body || {};
  const roomIds = type === "rooms" && Array.isArray(reservationIds) ? [...new Set(reservationIds.map(Number))] : [Number(reservationId)];
  const lookupIds = type === "rooms" ? roomIds : [Number(reservationId)];
  if (roomIds.some((id) => !Number.isInteger(id) || id < 1)
    || !["rooms", "equipment"].includes(type) || !/^\d+$/.test(String(reservationId)) || !Array.isArray(periods) || periods.length < 1 || periods.length > 21 || (!(type === "rooms" && isMonthlyPeriodList(periods)) && periods.some((period) => !validDateTime(period?.start) || !validDateTime(period?.end)
      || !(type === "equipment" ? isValidEquipmentReservation(type, period) : isValidReservationPeriod(type, period))))) {
    return res.status(400).json({ error: "Choose valid one-hour reservation slots." });
  }
  const requiredBufferMinutes = 15;
  const normalizedPeriods = type === "equipment"
    ? mergeAdjacentReservationPeriods(periods)
    : type === "rooms" && !isMonthlyPeriodList(periods)
      ? mergeRoomReservationPeriods(periods)
      : periods;
  const validationPeriods = normalizedPeriods;
  if (!(type === "rooms" && isMonthlyPeriodList(periods)) && !hasReservationBuffer(validationPeriods, requiredBufferMinutes)) {
    return res.status(400).json({ error: `Reservations must have at least a ${requiredBufferMinutes}-minute buffer between periods.` });
  }
  const maxAdvance = type === "rooms" ? 90 : 31;
  if (normalizedPeriods.some(({ start }) => !Number.isFinite(businessTime(start)) || businessTime(start) <= Date.now() || businessTime(start) > Date.now() + maxAdvance * 86400000)) {
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
      `SELECT ${idColumn} AS reservation_id, ${resourceColumn} AS resource_id, stripe_checkout_session_id, ${startColumn} AS start_time, ${endColumn} AS end_time FROM ${table}
       WHERE ${idColumn} = ${room ? "ANY($1::integer[])" : "$1"} AND user_id = $2 ${statusClause} ORDER BY ${startColumn} FOR UPDATE`,
      [room ? lookupIds : Number(reservationId), user.user_id]
    );
    if (!current.rowCount || (room && current.rowCount !== lookupIds.length)
      || current.rows.some((row) => String(row.resource_id) !== String(current.rows[0].resource_id))) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(404).json({ error: "Reservation not found." });
    }
    const currentStart = current.rows[0].start_time;
    const currentEnd = current.rows.at(-1).end_time;
    const monthly = room && current.rowCount === 1 && isMonthlyReservation(currentStart, currentEnd);
    const requestedMonthly = room && isMonthlyPeriodList(periods);
    const currentMonthlyCount = monthly ? getMonthlyReservationCount(currentStart, currentEnd) : null;
    if (requestedMonthly) {
      if (!monthly) {
        await client.query("ROLLBACK");
        transactionStarted = false;
        return res.status(400).json({ error: "A studio month rental can only be changed from an existing monthly reservation." });
      }
      const roomDetails = await client.query('SELECT name, type FROM "room" WHERE room_id = $1', [Number(current.rows[0].resource_id)]);
      if (!roomDetails.rowCount || !isMonthlyStudioResource({ name: roomDetails.rows[0].name, description: roomDetails.rows[0].type })) {
        await client.query("ROLLBACK");
        transactionStarted = false;
        return res.status(400).json({ error: "Only studio reservations can be changed by calendar month." });
      }
    }
    if (room && current.rowCount > 1 && current.rows.some((row) => row.stripe_checkout_session_id)) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(400).json({ error: "A paid monthly room rental cannot be edited as a grouped hourly reservation." });
    }
    if (monthly && (!isMonthlyPeriodList(periods) || getMonthlyReservationCount(periods[0].start, periods[0].end) !== currentMonthlyCount)) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(400).json({ error: `A paid studio rental must remain ${currentMonthlyCount} month${currentMonthlyCount === 1 ? "" : "s"}.` });
    }
    const buffer = room && (monthly || current.rowCount > 1) ? "0 minutes" : room ? "15 minutes" : "0 minutes";
    const resourceId = Number(current.rows[0].resource_id);
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1), $2)", [type, resourceId]);
    const preservePaidDuration = type === "equipment" && !!current.rows[0].stripe_checkout_session_id;
    if (preservePaidDuration) {
      if (normalizedPeriods.length !== 1) {
        await client.query("ROLLBACK");
        transactionStarted = false;
        return res.status(400).json({ error: "A paid machine reservation must remain one continuous time block." });
      }
      const currentDuration = businessTime(current.rows.at(-1).end_time) - businessTime(current.rows[0].start_time);
      const requestedDuration = normalizedPeriods.reduce((total, period) => total + businessTime(period.end) - businessTime(period.start), 0);
      if (requestedDuration !== currentDuration) {
        await client.query("ROLLBACK");
        transactionStarted = false;
        return res.status(400).json({ error: "A paid machine reservation must keep the same total number of hours." });
      }
    }
    for (const period of normalizedPeriods) {
      const conflict = await client.query(
        `SELECT 1 FROM ${table}
         WHERE ${resourceColumn} = $1 AND NOT (${idColumn} = ANY($2::integer[]))
           AND ${startColumn} < $4::timestamp + INTERVAL '${buffer}'
           AND ${endColumn} > $3::timestamp - INTERVAL '${buffer}' ${statusClause}
         LIMIT 1`,
        [resourceId, room ? roomIds : [Number(reservationId)], period.start, period.end]
      );
      if (conflict.rowCount) {
        await client.query("ROLLBACK");
        transactionStarted = false;
        return res.status(409).json({ error: "One or more selected times are no longer available." });
      }
    }

    if (room && normalizedPeriods.length === 1) {
      await client.query(
        `UPDATE ${table} SET ${startColumn} = $3, ${endColumn} = $4 WHERE ${idColumn} = $1 AND user_id = $2`,
        [Number(reservationId), user.user_id, normalizedPeriods[0].start, normalizedPeriods[0].end]
      );
      await client.query(
        `DELETE FROM ${table} WHERE ${idColumn} = ANY($1::integer[]) AND user_id = $2 AND ${idColumn} <> $3`,
        [roomIds, user.user_id, Number(reservationId)]
      );
    } else if (normalizedPeriods.length === 1 || preservePaidDuration) {
      await client.query(
        `UPDATE ${table} SET ${startColumn} = $3, ${endColumn} = $4 WHERE ${idColumn} = $1 AND user_id = $2`,
        [Number(reservationId), user.user_id, normalizedPeriods[0].start, normalizedPeriods[0].end]
      );
    } else {
      await client.query(`DELETE FROM ${table} WHERE ${idColumn} = ANY($1::integer[]) AND user_id = $2`, [roomIds, user.user_id]);
      for (const period of normalizedPeriods) {
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
