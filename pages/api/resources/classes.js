import { getPool } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { loadClasses } from "@/lib/resources";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Sign in to view classes." });
  try {
    const [classes, enrollments] = await Promise.all([
      loadClasses(),
      getPool().query(
        `SELECT class_id, COUNT(*)::integer AS count, BOOL_OR(user_id = $1) AS enrolled
         FROM "class_enrollment" GROUP BY class_id`,
        [user.user_id]
      ),
    ]);
    const counts = new Map(enrollments.rows.map((row) => [String(row.class_id), row]));
    const result = classes.map((item) => {
      const classId = String(item.resourceId);
      const capacity = item.spots ? Number.parseInt(item.spots, 10) : Number.NaN;
      const enrollment = counts.get(classId);
      const full = Number.isFinite(capacity) && (enrollment?.count || 0) >= capacity;
      return { ...item, unavailable: (full && !enrollment?.enrolled) || null };
    });
    return res.status(200).json({ classes: result });
  } catch (error) {
    console.error("Load classes error:", error);
    return res.status(500).json({ error: "Could not load classes." });
  }
}
