import { getSessionUser, WAIVER_REQUIRED } from "@/lib/session";
import { verifyCsrfToken } from "@/lib/csrf";
import { enrollUserInClass } from "@/lib/reservationService";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Sign in to reserve a class." });
  if (!verifyCsrfToken(req)) return res.status(403).json({ error: "Invalid or missing CSRF token." });
  if (user.waiver_status !== true) return res.status(403).json(WAIVER_REQUIRED);

  const result = await enrollUserInClass({ userId: user.user_id, classId: Number(req.body?.resourceId) });
  if (result.status === 409 && result.body.error.startsWith("This member is already")) {
    return res.status(409).json({ error: "You are already enrolled in this class." });
  }
  if (result.status !== 201) return res.status(result.status).json(result.body);
  return res.status(201).json({ ok: true, reservationId: result.body.reservationIds[0] });
}
