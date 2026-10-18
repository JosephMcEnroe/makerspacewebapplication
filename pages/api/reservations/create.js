import { getSessionUser } from "@/lib/session";
import { verifyCsrfToken } from "@/lib/csrf";
import { createResourceReservations } from "@/lib/reservationService";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Sign in to make a reservation." });
  if (!verifyCsrfToken(req)) return res.status(403).json({ error: "Invalid or missing CSRF token." });

  const { type, resourceId, periods } = req.body || {};
  const { status, body } = await createResourceReservations({ userId: user.user_id, type, resourceId, periods });
  return res.status(status).json(body);
}
