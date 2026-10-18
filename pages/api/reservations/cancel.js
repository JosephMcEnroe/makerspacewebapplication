import { getSessionUser } from "@/lib/session";
import { verifyCsrfToken } from "@/lib/csrf";
import { cancelUserReservation } from "@/lib/reservationService";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Sign in to cancel a reservation." });
  if (!verifyCsrfToken(req)) return res.status(403).json({ error: "Invalid or missing CSRF token." });

  const { type, reservationId } = req.body || {};
  const { status, body } = await cancelUserReservation({ userId: user.user_id, type, reservationId });
  return res.status(status).json(body);
}
