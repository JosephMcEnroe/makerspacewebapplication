import { businessTime } from "@/lib/businessTime";
import { getPool } from "@/lib/db";
import { hasReservationBuffer, isValidReservationPeriod } from "@/lib/reservationPeriods";

// Shared booking logic for room/equipment reservations and class enrollment.
// Each function returns { status, body } so API routes can send it as-is,
// whether the member is booking for themselves or staff is booking for them.

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

export async function createResourceReservations({ userId, type, resourceId, periods }) {
  if (!(["rooms", "equipment"].includes(type)) || !/^\d+$/.test(String(resourceId)) || !Array.isArray(periods) || periods.length < 1 || periods.length > 21) {
    return { status: 400, body: { error: "Invalid reservation details." } };
  }
  if (periods.some((period) => !validDateTime(period?.start) || !validDateTime(period?.end) || !isValidReservationPeriod(type, period))) {
    return { status: 400, body: { error: "Choose a valid one-hour reservation slot." } };
  }
  if (!hasReservationBuffer(periods)) {
    return { status: 400, body: { error: "Reservations must have at least a 15-minute buffer between periods." } };
  }
  const now = Date.now();
  const maxAdvance = type === "rooms" ? 90 : 31;
  if (periods.some(({ start, end }) => {
    const startTime = businessTime(start);
    const endTime = businessTime(end);
    return !Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime <= now || startTime > now + maxAdvance * 24 * 60 * 60 * 1000 || endTime - startTime > 24 * 60 * 60 * 1000;
  })) {
    return { status: 400, body: { error: `Reservations can be made up to ${maxAdvance} days ahead and may last up to 24 hours.` } };
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
        return { status: 409, body: { error: "One or more selected times are no longer available. Refresh the page and choose another time." } };
      }
      if (type === "rooms") {
        const inserted = await client.query(
          `INSERT INTO "room_reservation" (user_id, room_id, start_date, end_date, status)
           VALUES ($1, $2, $3, $4, 'upcoming')
           RETURNING reservation_id`,
          [userId, Number(resourceId), period.start, period.end]
        );
        reservationIds.push(inserted.rows[0].reservation_id);
      } else {
        const inserted = await client.query(
          `INSERT INTO "machine_booking" (machine_id, start_date_time, end_date_time, user_id)
           VALUES ($1, $2, $3, $4)
           RETURNING booking_id`,
          [Number(resourceId), period.start, period.end, userId]
        );
        reservationIds.push(inserted.rows[0].booking_id);
      }
    }
    await client.query("COMMIT");
    transactionStarted = false;
    return { status: 201, body: { ok: true, reservationIds } };
  } catch (error) {
    if (transactionStarted) await client.query("ROLLBACK").catch(() => {});
    console.error("Create reservation error:", error);
    return { status: 500, body: { error: "Could not save the reservation. Please try again." } };
  } finally {
    client?.release();
  }
}

// Enrolls a user in a class. class_date holds the full start timestamp.
export async function enrollUserInClass({ userId, classId }) {
  if (!Number.isInteger(classId) || classId < 1) {
    return { status: 400, body: { error: "Select a valid class." } };
  }

  let client;
  let transactionStarted = false;
  try {
    client = await getPool().connect();
    await client.query("BEGIN");
    transactionStarted = true;
    const classResult = await client.query(
      `SELECT class_id, max_capacity, class_date > NOW() AS is_upcoming
       FROM "class" WHERE class_id = $1 FOR UPDATE`,
      [classId]
    );
    const rollback = async (status, error) => {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return { status, body: { error } };
    };
    if (classResult.rowCount === 0) return rollback(404, "Class not found.");
    const classRow = classResult.rows[0];
    if (!classRow.is_upcoming) return rollback(400, "This class has already started.");

    await client.query(`CREATE TABLE IF NOT EXISTS "class_enrollment" (
      user_id INTEGER NOT NULL REFERENCES "users"(user_id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES "class"(class_id) ON DELETE CASCADE,
      enrolled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, class_id)
    )`);
    const existing = await client.query(
      `SELECT 1 FROM "class_enrollment" WHERE user_id = $1 AND class_id = $2`,
      [userId, classId]
    );
    if (existing.rowCount > 0) return rollback(409, "This member is already enrolled in this class.");
    const enrollmentCount = await client.query(
      `SELECT COUNT(*)::integer AS count FROM "class_enrollment" WHERE class_id = $1`,
      [classId]
    );
    if (classRow.max_capacity && enrollmentCount.rows[0].count >= classRow.max_capacity) {
      return rollback(409, "This class is full.");
    }
    await client.query(
      `INSERT INTO "class_enrollment" (user_id, class_id) VALUES ($1, $2)`,
      [userId, classId]
    );
    await client.query("COMMIT");
    transactionStarted = false;
    return { status: 201, body: { ok: true, reservationIds: [classId] } };
  } catch (error) {
    if (transactionStarted) await client.query("ROLLBACK").catch(() => {});
    console.error("Class enrollment error:", error);
    return { status: 500, body: { error: "Could not reserve a spot in this class." } };
  } finally {
    client?.release();
  }
}

// Cancels one of a user's reservations. Rooms are soft-cancelled to keep history.
export async function cancelUserReservation({ userId, type, reservationId }) {
  const id = Number(reservationId);
  if (!Number.isInteger(id) || id < 1 || !["room", "equipment", "class"].includes(type)) {
    return { status: 400, body: { error: "Invalid reservation." } };
  }

  try {
    let result;
    if (type === "class") {
      result = await getPool().query(
        `DELETE FROM "class_enrollment" WHERE class_id = $1 AND user_id = $2 RETURNING class_id`,
        [id, userId]
      );
    } else if (type === "room") {
      result = await getPool().query(
        `UPDATE "room_reservation" SET status = 'cancelled'
         WHERE reservation_id = $1 AND user_id = $2
           AND (status IS NULL OR LOWER(status) NOT LIKE 'cancel%')
         RETURNING reservation_id`,
        [id, userId]
      );
    } else {
      result = await getPool().query(
        `DELETE FROM "machine_booking" WHERE booking_id = $1 AND user_id = $2 RETURNING booking_id`,
        [id, userId]
      );
    }
    if (!result.rowCount) return { status: 404, body: { error: "Reservation not found." } };
    return { status: 200, body: { ok: true } };
  } catch (error) {
    console.error("Cancel reservation error:", error);
    return { status: 500, body: { error: "Could not cancel the reservation." } };
  }
}
