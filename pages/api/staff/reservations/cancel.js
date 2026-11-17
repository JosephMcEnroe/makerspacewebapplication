import { verifyCsrfToken } from "@/lib/csrf";
import { requireStaffApi } from "@/lib/staffAuth";
import { cancelUserReservation } from "@/lib/reservationService";

// Staff cancels a reservation that belongs to a member
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const session = await requireStaffApi(req, res);
  if (!session) return;
  if (!verifyCsrfToken(req)) return res.status(403).json({ error: "Invalid or missing CSRF token." });

  const { userId, type, reservationId, preview, quote } = req.body || {};
  const memberId = Number(userId);
  if (!Number.isInteger(memberId) || memberId < 1) {
    return res.status(400).json({ error: "Select a valid member." });
  }

  res.setHeader("Cache-Control", "no-store");
  const { status, body } = await cancelUserReservation({ userId: memberId, actorId: session.user.user_id, type, reservationId, preview: preview === true, quote });
  return res.status(status).json(body);
}
