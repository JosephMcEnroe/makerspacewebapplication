import { getPool } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { verifyCsrfToken } from "@/lib/csrf";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Sign in to edit a class reservation." });
  if (!verifyCsrfToken(req)) return res.status(403).json({ error: "Invalid or missing CSRF token." });
  const oldClassId = Number(req.body?.oldClassId);
  const newClassId = Number(req.body?.newClassId);
  if (!Number.isInteger(oldClassId) || oldClassId < 1 || !Number.isInteger(newClassId) || newClassId < 1) {
    return res.status(400).json({ error: "Choose a valid class." });
  }
  let client;
  let transactionStarted = false;
  try {
    client = await getPool().connect();
    await client.query("BEGIN");
    transactionStarted = true;
    const existing = await client.query(
      `SELECT 1 FROM "class_enrollment" WHERE user_id = $1 AND class_id = $2 FOR UPDATE`,
      [user.user_id, oldClassId]
    );
    if (!existing.rowCount) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(404).json({ error: "Class reservation not found." });
    }
    const target = await client.query(
      `SELECT class_id, class_date, class_time, max_capacity FROM "class" WHERE class_id = $1 FOR UPDATE`,
      [newClassId]
    );
    const targetDate = target.rowCount
      ? new Date(`${target.rows[0].class_date instanceof Date ? target.rows[0].class_date.toISOString().slice(0, 10) : String(target.rows[0].class_date).slice(0, 10)}T${String(target.rows[0].class_time || "00:00").slice(0, 5)}:00`)
      : null;
    if (!target.rowCount || Number.isNaN(targetDate.getTime()) || targetDate <= new Date()) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(404).json({ error: "The selected class is no longer available." });
    }
    if (oldClassId !== newClassId) {
      const alreadyEnrolled = await client.query(
        `SELECT 1 FROM "class_enrollment" WHERE user_id = $1 AND class_id = $2`,
        [user.user_id, newClassId]
      );
      if (alreadyEnrolled.rowCount) {
        await client.query("ROLLBACK");
        transactionStarted = false;
        return res.status(409).json({ error: "You are already enrolled in that class." });
      }
      const enrolled = await client.query(
        `SELECT COUNT(*)::integer AS count FROM "class_enrollment" WHERE class_id = $1`,
        [newClassId]
      );
      if (target.rows[0].max_capacity && enrolled.rows[0].count >= target.rows[0].max_capacity) {
        await client.query("ROLLBACK");
        transactionStarted = false;
        return res.status(409).json({ error: "That class is full." });
      }
      await client.query(
        `UPDATE "class_enrollment" SET class_id = $3 WHERE user_id = $1 AND class_id = $2`,
        [user.user_id, oldClassId, newClassId]
      );
    }
    await client.query("COMMIT");
    transactionStarted = false;
    return res.status(200).json({ ok: true });
  } catch (error) {
    if (transactionStarted) await client.query("ROLLBACK").catch(() => {});
    console.error("Update class reservation error:", error);
    return res.status(500).json({ error: "Could not update the class reservation." });
  } finally {
    client?.release();
  }
}
