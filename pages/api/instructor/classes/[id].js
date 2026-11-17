import { getInstructorSession } from "@/lib/instructorAuth";
import { verifyCsrfToken } from "@/lib/csrf";
import { classRepository } from "@/Data_Access_Layer/classRepository";

// Lets an instructor edit the description of a class they teach. Name, date,
// time and capacity are managed by staff and are not writable here.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");

  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getInstructorSession(req);
  if (!session) {
    return res.status(401).json({ error: "Sign in to edit a class description." });
  }
  if (!session.isInstructor) {
    return res.status(403).json({ error: "Only instructors can edit a class description." });
  }

  const classId = Number(req.query.id);
  if (!Number.isInteger(classId) || classId < 1) {
    return res.status(400).json({ error: "Invalid class." });
  }

  if (!verifyCsrfToken(req)) {
    return res.status(403).json({ error: "Invalid or missing CSRF token." });
  }

  const rawDescription = req.body?.description;
  if (rawDescription !== null && rawDescription !== undefined && typeof rawDescription !== "string") {
    return res.status(400).json({ error: "Description must be text." });
  }
  const description = typeof rawDescription === "string" ? rawDescription.trim() : "";

  if (description.length > 2000) {
    return res.status(400).json({ error: "Description must be 2000 characters or less." });
  }

  try {
    const repo = new classRepository();
    const course = await repo.findClass(classId);

    if (!course) {
      return res.status(404).json({ error: "Class not found." });
    }
    if (String(course.user_id) !== String(session.user.user_id)) {
      return res.status(403).json({ error: "You can only edit classes you instruct." });
    }

    const updated = await repo.updateClassDescription(classId, description || null);

    return res.status(200).json({
      ok: true,
      description: updated?.description ?? "",
    });
  } catch (error) {
    console.error("Class description update error:", error);
    return res.status(500).json({ error: "Could not save the description. Please try again." });
  }
}
