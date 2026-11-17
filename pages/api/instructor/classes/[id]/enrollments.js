import { getInstructorSession } from "@/lib/instructorAuth";
import { verifyCsrfToken } from "@/lib/csrf";
import { classRepository } from "@/Data_Access_Layer/classRepository";

// Lets an instructor take a student out of a class they teach. The class must
// belong to the signed-in instructor; nobody can touch another's roster.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");

  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getInstructorSession(req);
  if (!session) {
    return res.status(401).json({ error: "Sign in to manage a class roster." });
  }
  if (!session.isInstructor) {
    return res.status(403).json({ error: "Only instructors can manage a class roster." });
  }

  const classId = Number(req.query.id);
  if (!Number.isInteger(classId) || classId < 1) {
    return res.status(400).json({ error: "Invalid class." });
  }

  const studentId = Number(req.body?.studentId);
  if (!Number.isInteger(studentId) || studentId < 1) {
    return res.status(400).json({ error: "Select a student to remove." });
  }

  if (!verifyCsrfToken(req)) {
    return res.status(403).json({ error: "Invalid or missing CSRF token." });
  }

  try {
    const repo = new classRepository();
    const course = await repo.findClass(classId);

    if (!course) {
      return res.status(404).json({ error: "Class not found." });
    }
    if (String(course.user_id) !== String(session.user.user_id)) {
      return res.status(403).json({ error: "You can only manage classes you instruct." });
    }

    const removed = await repo.removeEnrollment(classId, studentId);
    if (!removed) {
      return res.status(404).json({ error: "That student is not enrolled in this class." });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Class roster update error:", error);
    return res.status(500).json({ error: "Could not update the class roster. Please try again." });
  }
}
