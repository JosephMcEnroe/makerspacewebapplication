import { businessDateTime } from "@/lib/businessTime";
import { businessTime } from "@/lib/businessTime";
import { getPool } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { MEMBERSHIP_REQUIRED_MESSAGE, canReserve } from "@/lib/reservationAccess";
import { verifyCsrfToken } from "@/lib/csrf";
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Sign in to reserve a class." });
  if (!canReserve(user)) return res.status(403).json({ error: MEMBERSHIP_REQUIRED_MESSAGE });
  if (!verifyCsrfToken(req)) return res.status(403).json({ error: "Invalid or missing CSRF token." });

  const classId = Number(req.body?.resourceId);
  const startsAt = req.body?.start;
  if (!Number.isInteger(classId) || classId < 1 || typeof startsAt !== "string" || startsAt.length !== 19 || startsAt[4] !== "-" || startsAt[7] !== "-" || startsAt[10] !== "T" || startsAt[13] !== ":" || startsAt.slice(16) !== ":00") {
    return res.status(400).json({ error: "Select a valid class time." });
  }
  const year = Number(startsAt.slice(0, 4));
  const month = Number(startsAt.slice(5, 7));
  const day = Number(startsAt.slice(8, 10));
  const requestedHour = Number(startsAt.slice(11, 13));
  const requestedMinute = Number(startsAt.slice(14, 16));
  if (month < 1 || month > 12 || day < 1 || requestedHour > 23 || requestedMinute > 59 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) {
    return res.status(400).json({ error: "Select a valid class time." });
  }

  let client;
  let transactionStarted = false;
  try {
    client = await getPool().connect();
    await client.query("BEGIN");
    transactionStarted = true;
    const classResult = await client.query(
      `SELECT class_id, max_capacity, class_date, class_time
       FROM "class" WHERE class_id = $1 FOR UPDATE`,
      [classId]
    );
    if (classResult.rowCount === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(404).json({ error: "Class not found." });
    }
    const classRow = classResult.rows[0];
    const classDate = classRow.class_date instanceof Date
      ? businessDateTime(classRow.class_date).slice(0, 10)
      : String(classRow.class_date).slice(0, 10);
    const classTime = String(classRow.class_time).slice(0, 5);
    const [classHour, classMinute] = classTime.split(":").map(Number);
    const selectedDate = startsAt.slice(0, 10);
    if (selectedDate !== classDate || requestedHour !== classHour || requestedMinute !== classMinute || businessTime(startsAt) <= Date.now()) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(400).json({ error: "The selected time does not match this class schedule." });
    }
    await client.query(`CREATE TABLE IF NOT EXISTS "class_enrollment" (
      user_id INTEGER NOT NULL REFERENCES "users"(user_id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES "class"(class_id) ON DELETE CASCADE,
      enrolled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, class_id)
    )`);
    const existing = await client.query(
      `SELECT 1 FROM "class_enrollment" WHERE user_id = $1 AND class_id = $2`,
      [user.user_id, classId]
    );
    if (existing.rowCount > 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(409).json({ error: "You are already enrolled in this class." });
    }
    const enrollmentCount = await client.query(
      `SELECT COUNT(*)::integer AS count FROM "class_enrollment" WHERE class_id = $1`,
      [classId]
    );
    const capacity = classRow.max_capacity;
    if (capacity && enrollmentCount.rows[0].count >= capacity) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(409).json({ error: "This class is full." });
    }
    const enrollment = await client.query(
      `INSERT INTO "class_enrollment" (user_id, class_id) VALUES ($1, $2)
       RETURNING class_id`,
      [user.user_id, classId]
    );
    await client.query("COMMIT");
    transactionStarted = false;
    return res.status(201).json({ ok: true, reservationId: enrollment.rows[0].class_id });
  } catch (error) {
    if (transactionStarted) await client.query("ROLLBACK").catch(() => {});
    console.error("Class reservation error:", error);
    return res.status(500).json({ error: "Could not reserve a spot in this class." });
  } finally {
    client?.release();
  }
}
