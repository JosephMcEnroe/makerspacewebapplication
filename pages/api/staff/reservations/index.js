import { verifyCsrfToken } from "@/lib/csrf";
import { requireStaffApi } from "@/lib/staffAuth";
import { createResourceReservations, enrollUserInClass } from "@/lib/reservationService";
import { UserRepository } from "@/Data_Access_Layer/UserRepository";

// Staff books a room, equipment, or class on behalf of a member
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!(await requireStaffApi(req, res))) return;
  if (!verifyCsrfToken(req)) return res.status(403).json({ error: "Invalid or missing CSRF token." });

  const { userId, type, resourceId, periods } = req.body || {};
  const memberId = Number(userId);
  if (!Number.isInteger(memberId) || memberId < 1 || !(await new UserRepository().findById(memberId))) {
    return res.status(400).json({ error: "Select a valid member." });
  }

  const { status, body } = type === "classes"
    ? await enrollUserInClass({ userId: memberId, classId: Number(resourceId) })
    : await createResourceReservations({ userId: memberId, type, resourceId, periods });
  return res.status(status).json(body);
}
